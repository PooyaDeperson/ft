import { useEffect } from "react";
import { useFrame, useGraph } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { blendshapes, rotation, headMesh, handResult, poseResult } from "./FaceTracking";

// Helper function to calculate rotation between two vectors
const getRotation = (start: THREE.Vector3, end: THREE.Vector3) => {
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3().crossVectors(start, end).normalize();
  const angle = start.angleTo(end);
  q.setFromAxisAngle(axis, angle);
  return new THREE.Euler().setFromQuaternion(q);
};

// Main function to apply rotations to bones
const applyHandRotations = (nodes: any, handData: any, handedness: "Left" | "Right") => {
  const fingerBones = [
    [`${handedness}HandThumb1`, `${handedness}HandThumb2`, `${handedness}HandThumb3`],
    [`${handedness}HandIndex1`, `${handedness}HandIndex2`, `${handedness}HandIndex3`],
    [`${handedness}HandMiddle1`, `${handedness}HandMiddle2`, `${handedness}HandMiddle3`],
    [`${handedness}HandRing1`, `${handedness}HandRing2`, `${handedness}HandRing3`],
    [`${handedness}HandPinky1`, `${handedness}HandPinky2`, `${handedness}HandPinky3`],
  ];

  const worldLandmarks = handData.worldLandmarks;

  // Wrist rotation
  const wrist = nodes[`${handedness}Hand`];
  if (wrist) {
    const wristLandmark = new THREE.Vector3(-worldLandmarks[0].x, worldLandmarks[0].y, worldLandmarks[0].z);
    const middleFingerBase = new THREE.Vector3(-worldLandmarks[9].x, worldLandmarks[9].y, worldLandmarks[9].z);
    const wristRotation = getRotation(new THREE.Vector3(0, 1, 0), middleFingerBase.clone().sub(wristLandmark).normalize());
    wrist.rotation.set(wristRotation.x, wristRotation.y, wristRotation.z);
  }

  // Finger rotations
  fingerBones.forEach((finger, i) => {
    const baseIndex = i * 4 + 1;
    for (let j = 0; j < finger.length; j++) {
      const bone = nodes[finger[j]];
      if (bone) {
        const startLandmark = new THREE.Vector3(-worldLandmarks[baseIndex + j].x, worldLandmarks[baseIndex + j].y, worldLandmarks[baseIndex + j].z);
        const endLandmark = new THREE.Vector3(-worldLandmarks[baseIndex + j + 1].x, worldLandmarks[baseIndex + j + 1].y, worldLandmarks[baseIndex + j + 1].z);
        const fingerRotation = getRotation(new THREE.Vector3(0, 1, 0), endLandmark.clone().sub(startLandmark).normalize());
        bone.rotation.set(fingerRotation.x, fingerRotation.y, fingerRotation.z);
      }
    }
  });
};

const applyPoseRotations = (nodes: any, poseData: any) => {
  const worldLandmarks = poseData.worldLandmarks;

  // Negate X to correct for mirrored video feed
  const leftShoulder = new THREE.Vector3(-worldLandmarks[11].x, worldLandmarks[11].y, worldLandmarks[11].z);
  const rightShoulder = new THREE.Vector3(-worldLandmarks[12].x, worldLandmarks[12].y, worldLandmarks[12].z);
  const leftElbow = new THREE.Vector3(-worldLandmarks[13].x, worldLandmarks[13].y, worldLandmarks[13].z);
  const rightElbow = new THREE.Vector3(-worldLandmarks[14].x, worldLandmarks[14].y, worldLandmarks[14].z);
  const leftWrist = new THREE.Vector3(-worldLandmarks[15].x, worldLandmarks[15].y, worldLandmarks[15].z);
  const rightWrist = new THREE.Vector3(-worldLandmarks[16].x, worldLandmarks[16].y, worldLandmarks[16].z);

  if (nodes.LeftArm) {
    const shoulderRotation = getRotation(new THREE.Vector3(-1, 0, 0), leftElbow.clone().sub(leftShoulder).normalize());
    nodes.LeftArm.rotation.set(shoulderRotation.x, shoulderRotation.y, shoulderRotation.z);
  }
  if (nodes.RightArm) {
    const shoulderRotation = getRotation(new THREE.Vector3(1, 0, 0), rightElbow.clone().sub(rightShoulder).normalize());
    nodes.RightArm.rotation.set(shoulderRotation.x, shoulderRotation.y, shoulderRotation.z);
  }
  if (nodes.LeftForeArm) {
    const elbowRotation = getRotation(new THREE.Vector3(-1, 0, 0), leftWrist.clone().sub(leftElbow).normalize());
    nodes.LeftForeArm.rotation.set(elbowRotation.x, elbowRotation.y, elbowRotation.z);
  }
  if (nodes.RightForeArm) {
    const elbowRotation = getRotation(new THREE.Vector3(1, 0, 0), rightWrist.clone().sub(rightElbow).normalize());
    nodes.RightForeArm.rotation.set(elbowRotation.x, elbowRotation.y, elbowRotation.z);
  }
};

interface AvatarProps {
  url: string;
  onLoaded?: () => void;
}

function Avatar({ url, onLoaded }: AvatarProps) {
  const { scene } = useGLTF(url);
  const { nodes } = useGraph(scene);

  useEffect(() => {
    headMesh.length = 0;
    if (nodes.Wolf3D_Head) headMesh.push(nodes.Wolf3D_Head);
    if (nodes.Wolf3D_Teeth) headMesh.push(nodes.Wolf3D_Teeth);
    if (nodes.Wolf3D_Beard) headMesh.push(nodes.Wolf3D_Beard);
    if (nodes.Wolf3D_Avatar) headMesh.push(nodes.Wolf3D_Avatar);
    if (nodes.Wolf3D_Head_Custom) headMesh.push(nodes.Wolf3D_Head_Custom);

    if (onLoaded) onLoaded(); // ✅ fire callback
  }, [nodes, url, onLoaded]);

  useFrame(() => {
    if (blendshapes.length > 0) {
      blendshapes.forEach((element) => {
        headMesh.forEach((mesh) => {
          let index = mesh.morphTargetDictionary[element.categoryName];
          if (index >= 0) {
            mesh.morphTargetInfluences[index] = element.score;
          }
        });
      });
      nodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
      nodes.Neck.rotation.set(rotation.x / 5 + 0.3, rotation.y / 5, rotation.z / 5);
      nodes.Spine2.rotation.set(rotation.x / 10, rotation.y / 10, rotation.z / 10);
    }

    if (handResult && handResult.landmarks.length > 0) {
      const currentHandResult = handResult;
      currentHandResult.handednesses.forEach((hand, index) => {
        const handedness = hand[0].categoryName as "Left" | "Right";
        if (currentHandResult.worldLandmarks[index]) {
          const handData = {
            landmarks: currentHandResult.landmarks[index],
            worldLandmarks: currentHandResult.worldLandmarks[index],
          };
          applyHandRotations(nodes, handData, handedness);
        }
      });
    }

    if (poseResult && poseResult.landmarks.length > 0) {
      const currentPoseResult = poseResult;
      if (currentPoseResult.worldLandmarks) {
        const poseData = {
          landmarks: currentPoseResult.landmarks[0],
          worldLandmarks: currentPoseResult.worldLandmarks[0],
        };
        applyPoseRotations(nodes, poseData);
      }
    }
  });

  return <primitive object={scene} position={[0, 0, 0]} />;
}

export default Avatar;
