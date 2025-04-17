from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import librosa
import numpy as np
import tempfile
import os
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AudioAnalysisRequest(BaseModel):
    filePath: str
    tongueTwister: str = ""

@app.get("/")
async def read_root():
    return {"status": "Audio analysis service is running"}

@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    logger.info(f"Received file: {file.filename}, Content-Type: {file.content_type}")
    
    if not file:
        logger.error("No file uploaded")
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        try:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
            
            analysis_result = analyze_audio_file(temp_file.name)
            return {
                "data": {
                    "analysis": analysis_result,
                    "feedback": generate_feedback(analysis_result)
                }
            }
        except Exception as e:
            logger.error(f"Error analyzing audio: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
        finally:
            os.unlink(temp_file.name)

@app.post("/analyze-audio")
async def analyze_audio(request: AudioAnalysisRequest):
    logger.info(f"Received request to analyze file at path: {request.filePath}")
    
    try:
        if not os.path.exists(request.filePath):
            logger.error(f"File not found at path: {request.filePath}")
            raise HTTPException(status_code=404, detail="File not found")
        
        analysis_result = analyze_audio_file(request.filePath)
    
        feedback = generate_feedback(analysis_result, request.tongueTwister)
        
        return {
            "data": {
                "analysis": analysis_result,
                "feedback": feedback
            }
        }
    except Exception as e:
        logger.error(f"Error analyzing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

def analyze_audio_file(file_path):
    """Analyze audio file using librosa and return metrics."""
    try:
        y, sr = librosa.load(file_path, sr=None)
        
        duration = librosa.get_duration(y=y, sr=sr)
        
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0]
        
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitches = pitches[magnitudes > np.median(magnitudes)]
        pitch_mean = np.mean(pitches) if len(pitches) > 0 else 0
        pitch_std = np.std(pitches) if len(pitches) > 0 else 0
        
        speech_rate = duration > 0 and 3.0 * (tempo / 120.0) or 0
        
        rms_energy = np.sqrt(np.mean(y**2))
        
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
        spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
        
        return {
            "duration": float(duration),
            "tempo": float(tempo),
            "pitch_mean": float(pitch_mean),
            "pitch_std": float(pitch_std),
            "speech_rate": float(speech_rate),
            "rms_energy": float(rms_energy),
            "spectral_centroid": float(spectral_centroid),
            "spectral_bandwidth": float(spectral_bandwidth)
        }
    except Exception as e:
        logger.error(f"Error in audio analysis: {str(e)}")
        raise Exception(f"Audio analysis failed: {str(e)}")

def generate_feedback(analysis, tongue_twister=""):
    """Generate feedback based on audio analysis."""
    feedback = []
    
    if analysis["duration"] < 1.0:
        feedback.append("Your recording is very short. Try to pronounce each word clearly.")
    elif analysis["duration"] > 10.0:
        feedback.append("Your recording is quite long. Try to maintain a natural speaking pace.")

    if analysis["speech_rate"] < 2.0:
        feedback.append("Try speaking a bit faster while maintaining clarity.")
    elif analysis["speech_rate"] > 6.0:
        feedback.append("You're speaking quite fast! Try slowing down slightly for better clarity.")
    else:
        feedback.append("Good speaking pace!")
    
    if analysis["rms_energy"] < 0.05:
        feedback.append("Try speaking a bit louder for better clarity.")
    elif analysis["rms_energy"] > 0.5:
        feedback.append("Your volume is good and clear.")
    
    if analysis["pitch_std"] < 10:
        feedback.append("Try varying your pitch more to make your speech more engaging.")
    elif analysis["pitch_std"] > 40:
        feedback.append("You have good vocal expressiveness!")
    
    return " ".join(feedback)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)