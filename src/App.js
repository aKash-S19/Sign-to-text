import React from "react";
import HandTracker from "./HandTracker";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      <h1 className="heading">Sign Language to Text Converter Prototype</h1>
      <HandTracker />
    </div>
  );
}

export default App;
