from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import librosa
import numpy as np
import requests
import logging
import io
import ffmpeg
import tempfile
import os
import subprocess
import shutil

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

def check_ffmpeg():
    """Check if ffmpeg is installed and accessible."""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

class AudioAnalysisRequest(BaseModel):
    filePath: str
    tongueTwister: str = ""

@app.get("/")
async def read_root():
    return {"status": "Audio analysis service is running"}

@app.post("/analyze-audio")
async def analyze_audio(request: AudioAnalysisRequest):
    logger.info(f"Received request to analyze file at URL: {request.filePath}")
    
    if not check_ffmpeg():
        raise HTTPException(
            status_code=500,
            detail="ffmpeg is not installed or not accessible. Please install ffmpeg and ensure it's in your PATH."
        )
    
    try:
        logger.info(f"Downloading audio from URL: {request.filePath}")
        
        response = requests.get(request.filePath, timeout=30)
        if response.status_code != 200:
            logger.error(f"Failed to download file from URL: {request.filePath}")
            raise HTTPException(status_code=404, detail="Failed to download audio file")
        
        temp_dir = tempfile.mkdtemp()
        try:
            webm_path = os.path.join(temp_dir, "input.webm")
            with open(webm_path, 'wb') as f:
                f.write(response.content)
            
            wav_path = os.path.join(temp_dir, "output.wav")
            try:
                stream = ffmpeg.input(webm_path)
                stream = ffmpeg.output(stream, wav_path, acodec='pcm_s16le', ac=1, ar='16k')
                ffmpeg.run(stream, capture_stdout=True, capture_stderr=True)
            except ffmpeg.Error as e:
                logger.error(f"FFmpeg error: {e.stderr.decode()}")
                raise HTTPException(status_code=500, detail=f"Audio conversion failed: {e.stderr.decode()}")
            
            try:
                # Load audio with specific parameters for speech analysis
                y, sr = librosa.load(wav_path, sr=16000, mono=True)
                
                # Normalize audio
                y = librosa.util.normalize(y)
                
                # Remove silence
                y, _ = librosa.effects.trim(y, top_db=30)
                
            except Exception as e:
                logger.error(f"Librosa error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to load audio file: {str(e)}")
            
            try:
                analysis_result = analyze_audio_data(y, sr)
                feedback = generate_feedback(analysis_result, request.tongueTwister)
                
                return {
                    "success": True,
                    "data": {
                        "analysis": analysis_result,
                        "feedback": feedback
                    }
                }
            except Exception as e:
                logger.error(f"Analysis error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception as e:
        logger.error(f"Error analyzing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

def analyze_audio_data(y, sr):
    """Analyze audio data using librosa and return metrics."""
    try:
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
        
        zcr = np.mean(librosa.feature.zero_crossing_rate(y=y)[0])
        
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)
        
        return {
            "duration": float(duration),
            "tempo": float(tempo),
            "pitch_mean": float(pitch_mean),
            "pitch_std": float(pitch_std),
            "speech_rate": float(speech_rate),
            "rms_energy": float(rms_energy),
            "spectral_centroid": float(spectral_centroid),
            "spectral_bandwidth": float(spectral_bandwidth),
            "zero_crossing_rate": float(zcr),
            "mfcc_mean": [float(x) for x in mfcc_mean]
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
    
    if analysis["zero_crossing_rate"] < 0.1:
        feedback.append("Try to enunciate more clearly.")
    elif analysis["zero_crossing_rate"] > 0.3:
        feedback.append("Good clarity in your speech!")
    
    return " ".join(feedback)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)