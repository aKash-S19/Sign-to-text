import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import "./App.css";

const HandTracker = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [prediction, setPrediction] = useState("");
  const [message, setMessage] = useState("");
  const [lastSignTime, setLastSignTime] = useState(0);
  const [debugData, setDebugData] = useState({});
  const [collectingData, setCollectingData] = useState(false);
  const [collectedData, setCollectedData] = useState([]);
  const [currentLabel, setCurrentLabel] = useState("");

  useEffect(() => {
    const loadMediaPipe = async () => {
      if (!window.Hands || !window.drawConnectors || !window.Camera) {
        console.error("MediaPipe not loaded properly");
        return;
      }

      const hands = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      hands.onResults(onResults);

      if (
        typeof webcamRef.current !== "undefined" &&
        webcamRef.current !== null
      ) {
        const camera = new window.Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (webcamRef.current?.video) {
              await hands.send({ image: webcamRef.current.video });
            }
          },
          
          width: 640,
          height: 480,
        });
        camera.start();
      }
    };

    loadMediaPipe();
  }, []);

  const onResults = (results) => {
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");
    canvasElement.width = webcamRef.current.video.videoWidth;
    canvasElement.height = webcamRef.current.video.videoHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      let predictions = [];

      results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = results.multiHandedness?.[index]?.label || "Unknown";

        window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2,
        });

        window.drawLandmarks(canvasCtx, landmarks, {
          color: "#FF0000",
          lineWidth: 1,
        });

        const sign = recognizeSign(landmarks);
        if (sign && Date.now() - lastSignTime > 1500) {
          setPrediction(sign);
          setMessage((prev) => prev + " " + sign);
          setLastSignTime(Date.now());
        }

        if (collectingData && currentLabel) {
          setCollectedData((prevData) => [
            ...prevData,
            {
              label: currentLabel,
              landmarks: landmarks.map((l) => ({
                x: l.x,
                y: l.y,
                z: l.z,
              })),
            },
          ]);
        }

        predictions.push({
          hand: handedness,
          landmarks: landmarks.map((l) => ({
            x: l.x.toFixed(2),
            y: l.y.toFixed(2),
            z: l.z.toFixed(2),
          })),
        });
      });

      setDebugData({ handsDetected: predictions.length, hands: predictions });
    } else {
      setPrediction("");
      setDebugData({ handsDetected: 0, hands: [] });
    }

    canvasCtx.restore();
  };

  const recognizeSign = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexMcp = landmarks[5];
    const wrist = landmarks[0];

    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const distThumbIndex = Math.sqrt(dx * dx + dy * dy);

    if (
      thumbTip.y > indexTip.y &&
      middleTip.y > indexTip.y &&
      ringTip.y > indexTip.y &&
      pinkyTip.y > indexTip.y &&
      distThumbIndex < 0.08
    ) {
      return "A";
    }

    if (
      thumbTip.x < indexTip.x &&
      indexTip.y < middleTip.y &&
      middleTip.y < ringTip.y &&
      ringTip.y < pinkyTip.y &&
      distThumbIndex > 0.15
    ) {
      return "B";
    }

    const indexMiddleDist = Math.sqrt(
      Math.pow(indexTip.x - middleTip.x, 2) + Math.pow(indexTip.y - middleTip.y, 2)
    );
    const middleRingDist = Math.sqrt(
      Math.pow(middleTip.x - ringTip.x, 2) + Math.pow(middleTip.y - ringTip.y, 2)
    );

    if (
      distThumbIndex > 0.05 &&
      distThumbIndex < 0.13 &&
      indexMiddleDist < 0.07 &&
      middleRingDist < 0.07 &&
      middleTip.y < wrist.y &&
      ringTip.y < wrist.y
    ) {
      return "C";
    }
    const dze = wrist.y;
    const dxH = wrist.x - indexMcp.x;
    const dyH = wrist.y - indexMcp.y;
    const angleH = Math.atan2(dyH, dxH) * (180 / Math.PI);

    if (
      thumbTip.y < wrist.y &&
      indexTip.y < wrist.y &&
      middleTip.y < wrist.y &&
      ringTip.y < wrist.y &&
      pinkyTip.y < wrist.y &&
      angleH > -70 &&
      angleH < -10
    ) {
      return "HELLO";
    }

    if (
      thumbTip.x > indexTip.x &&
      indexTip.y < middleTip.y &&
      middleTip.y < ringTip.y &&
      ringTip.y < pinkyTip.y &&
      thumbTip.y < wrist.y &&
      indexTip.y < wrist.y
    ) {
      return "THANK YOU";
    }

    return null;
  };

  const clearMessage = () => {
    setMessage("");
  };

  const toggleCollecting = () => {
    setCollectingData((prev) => !prev);
  };

  const downloadData = () => {
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(collectedData, null, 2)], {
      type: "application/json",
    });
    element.href = URL.createObjectURL(file);
    element.download = "collected_sign_language_data.json";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="camera-wrapper">
      <div className="camera-container">
        <Webcam
          ref={webcamRef}
          style={{ width: 640, height: 480 }}
          mirrored
          screenshotFormat="image/jpeg"
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      <div className="prediction-box">
        {prediction && (
          <div>
            <span className="sign-text">{prediction}</span>
          </div>
        )}
      </div>

      <div className="message-container">
        <div className="message-box">{message.trim()}</div>
        <button className="clear-button" onClick={clearMessage}>
          Clear Message
        </button>
      </div>

      <div className="data-collection">
        <h3>Data Collection</h3>
        <input
          type="text"
          placeholder="Enter label (e.g., A, Hello)"
          value={currentLabel}
          onChange={(e) => setCurrentLabel(e.target.value)}
          className="label-input"
        />
        <button onClick={toggleCollecting} className="collect-button">
          {collectingData ? "Stop Collecting" : "Start Collecting"}
        </button>
        <button onClick={downloadData} className="download-button">
          Download Data
        </button>
      </div>

      <div className="debug-container">
        <h3>Debug Info</h3>
        <div className="debug-item">
          <h4>Hands Detected: {debugData.handsDetected}</h4>
        </div>
      </div>
    </div>
  );
};

export default HandTracker;
