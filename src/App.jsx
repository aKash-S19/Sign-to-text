import React from "react";
import HandTracker from "./HandTracker";
import "./App.css";

const App = () => {
  return (
    <div className="app-container">
      <h1 className="app-title">Sign Language to Text Converter</h1>
      <HandTracker />
    </div>
  );
};

export default App;
