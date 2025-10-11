import { useEffect, useRef, useCallback } from "react";
import {
  FaceLandmarker,
  FaceLandmarkerOptions,
  HandLandmarker,
  HandLandmarkerOptions,
  PoseLandmarker,
  PoseLandmarkerOptions,
  FilesetResolver,
  DrawingUtils,
  HandLandmarkerResult,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Euler, Matrix4 } from "three";

export let blendshapes: any[] = [];
export let rotation: Euler;
export let headMesh: any[] = [];
export let handResult: HandLandmarkerResult | null = null;
export let poseResult: PoseLandmarkerResult | null = null;

let faceLandmarker: FaceLandmarker;
let handLandmarker: HandLandmarker;
let poseLandmarker: PoseLandmarker;
let lastVideoTime = -1;

const faceOptions: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: "GPU",
  },
  numFaces: 1,
  runningMode: "VIDEO",
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
};

const handOptions: HandLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
    delegate: "GPU",
  },
  numHands: 2,
  runningMode: "VIDEO",
};

const poseOptions: PoseLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    delegate: "GPU",
  },
  numPoses: 1,
  runningMode: "VIDEO",
};

function FaceTracking({
  videoStream,
  onMediapipeReady,
}: {
  videoStream: MediaStream;
  onMediapipeReady?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);

  const setupMediapipe = useCallback(async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, faceOptions);
    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, handOptions);
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, poseOptions);

    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext("2d");
      if (canvasCtx) {
        drawingUtilsRef.current = new DrawingUtils(canvasCtx);
      }
    }

    if (onMediapipeReady) onMediapipeReady();
  }, [onMediapipeReady]);

  const predict = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !faceLandmarker || !handLandmarker || !poseLandmarker) return;

    const nowInMs = Date.now();
    if (lastVideoTime !== vid.currentTime) {
      lastVideoTime = vid.currentTime;
      const faceResult = faceLandmarker.detectForVideo(vid, nowInMs);
      const handDetectionResult = handLandmarker.detectForVideo(vid, nowInMs);
      const poseDetectionResult = poseLandmarker.detectForVideo(vid, nowInMs);

      if (faceResult.faceBlendshapes?.length && faceResult.faceBlendshapes[0].categories) {
        blendshapes = faceResult.faceBlendshapes[0].categories;
        const matrix = new Matrix4().fromArray(faceResult.facialTransformationMatrixes![0].data);
        rotation = new Euler().setFromRotationMatrix(matrix);
      }

      const canvas = canvasRef.current;
      const drawingUtils = drawingUtilsRef.current;
      const canvasCtx = canvas?.getContext("2d");

      if (canvasCtx && canvas && drawingUtils) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (handDetectionResult.landmarks && handDetectionResult.landmarks.length > 0) {
          handResult = handDetectionResult;
          for (const landmarks of handResult.landmarks) {
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
          }
        } else {
          handResult = null;
        }

        if (poseDetectionResult.landmarks && poseDetectionResult.landmarks.length > 0) {
          poseResult = poseDetectionResult;
          for (const landmarks of poseResult.landmarks) {
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#00FFFF", lineWidth: 5 });
            drawingUtils.drawLandmarks(landmarks, { color: "#FFFF00", lineWidth: 2 });
          }
        } else {
          poseResult = null;
        }
      }
    }

    requestAnimationFrame(predict);
  }, []);

  useEffect(() => {
    if (!videoStream) return;
    const vid = videoRef.current;
    if (!vid) return;
    vid.srcObject = videoStream;

    const onPlaying = () => {
      if (vid && canvasRef.current) {
        canvasRef.current.width = vid.videoWidth;
        canvasRef.current.height = vid.videoHeight;
      }
      setupMediapipe().then(predict);
    };

    vid.addEventListener("playing", onPlaying);
    vid.play().catch(e => console.error("Video play failed:", e));

    return () => {
      vid.removeEventListener("playing", onPlaying);
    };
  }, [videoStream, setupMediapipe, predict]);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        id="video"
        className="camera-feed w-1 tb:w-400 br-12 tb:br-24 m-4"
        style={{ transform: "scaleX(-1)" }}
        width="640"
        height="480"
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, transform: "scaleX(-1)" }}
        width="640"
        height="480"
      />
    </div>
  );
}

export default FaceTracking;
