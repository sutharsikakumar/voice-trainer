from fastapi import FastAPI, HTTPException
import librosa
import numpy as np
import soundfile as sf
import os

app = FastAPI()

@app.post("/analyze")
async def analyze_audio(file_path: str, tongue_twister: str):
    try:
        audio, sr = librosa.load(file_path, sr=None)
        duration = librosa.get_duration(y=audio, sr=sr)
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        pitches, magnitudes = librosa.piptrack(y=audio, sr=sr)
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(pitch)
        pitch_mean = np.mean(pitch_values) if pitch_values else 0
        pitch_std = np.std(pitch_values) if pitch_values else 0

        syllable_count = sum(len(word) for word in tongue_twister.split())
        speech_rate = syllable_count / duration if duration > 0 else 0

        rms = librosa.feature.rms(y=audio)[0]
        rms_energy = np.mean(rms)

        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr))
        spectral_bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=audio, sr=sr))

        feedback = (
            f"Your speech rate was {speech_rate:.2f} syllables per second. "
            f"The average pitch was {pitch_mean:.2f} Hz with a variation of {pitch_std:.2f} Hz. "
            f"Try to maintain consistent volume (current: {rms_energy * 100:.0f}%)."
        )

        return {
            "duration": float(duration),
            "tempo": float(tempo),
            "pitch_mean": float(pitch_mean),
            "pitch_std": float(pitch_std),
            "speech_rate": float(speech_rate),
            "rms_energy": float(rms_energy),
            "spectral_centroid": float(spectral_centroid),
            "spectral_bandwidth": float(spectral_bandwidth),
            "feedback": feedback,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)