export interface SpeechAnalysis {
    transcript: string;
    wpm: number;
    fillerWords: {
      count: number;
      percentage: number;
      words: Record<string, number>;
    };
    suggestions: string;
    additionalInfo: string;
  }
  
  export function analyzeSpeech(transcript: string, durationSeconds: number): SpeechAnalysis {
    const cleanTranscript = transcript.trim();
    
    const words = cleanTranscript.split(/\s+/);
    const wordCount = words.length;
    
    const wpm = Math.round((wordCount / durationSeconds) * 60);
    const fillerWordsList = ["um", "uh", "like", "you know", "so", "actually", "basically", "literally"];
    const fillerWordsCount: Record<string, number> = {};
    let totalFillerWords = 0;
    
    words.forEach(word => {
      const lowerWord = word.toLowerCase().replace(/[.,?!;:()]/g, '');
      if (fillerWordsList.includes(lowerWord)) {
        fillerWordsCount[lowerWord] = (fillerWordsCount[lowerWord] || 0) + 1;
        totalFillerWords++;
      }
    });
    
    const fillerPercentage = wordCount > 0 ? (totalFillerWords / wordCount) * 100 : 0;
    
    let suggestions = "";
    let additionalInfo = "";
    
    // WPM suggestions
    if (wpm < 120) {
      suggestions += "Your speaking pace is a bit slow at " + wpm + " words per minute. Consider speaking slightly faster to maintain audience engagement.\n\n";
    } else if (wpm > 160) {
      suggestions += "Your speaking pace is quite fast at " + wpm + " words per minute. Try slowing down slightly for better clarity.\n\n";
    } else {
      suggestions += "Your speaking pace is good at " + wpm + " words per minute.\n\n";
    }
    
    if (fillerPercentage > 5) {
      suggestions += `You used filler words frequently (${fillerPercentage.toFixed(1)}% of your speech). Try to reduce the use of: ${Object.keys(fillerWordsCount).join(", ")}.\n\n`;
      
      additionalInfo += "Most used filler words:\n";
      Object.entries(fillerWordsCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([word, count]) => {
          additionalInfo += `- "${word}": ${count} times\n`;
        });
    } else if (totalFillerWords > 0) {
      suggestions += `You used filler words occasionally (${fillerPercentage.toFixed(1)}% of your speech). Overall good, but you could further reduce: ${Object.keys(fillerWordsCount).join(", ")}.\n\n`;
    } else {
      suggestions += "Great job avoiding filler words in your speech!\n\n";
    }
    
    const speechQuality = assessSpeechQuality(cleanTranscript);
    suggestions += speechQuality.suggestions;
    additionalInfo += "\n" + speechQuality.additionalInfo;
    
    return {
      transcript: cleanTranscript,
      wpm,
      fillerWords: {
        count: totalFillerWords,
        percentage: fillerPercentage,
        words: fillerWordsCount
      },
      suggestions,
      additionalInfo
    };
  }
  

  function assessSpeechQuality(transcript: string) {
    const sentenceCount = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const wordCount = transcript.split(/\s+/).length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    let suggestions = "";
    let additionalInfo = "";
    
    if (avgWordsPerSentence > 25) {
      suggestions += "Consider using shorter, clearer sentences for better comprehension.\n\n";
      additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words (recommended: 15-20 words).\n`;
    } else if (avgWordsPerSentence < 10 && sentenceCount > 3) {
      suggestions += "Your sentences are quite short. Consider occasionally using more complex structures for variety.\n\n";
      additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words.\n`;
    } else {
      additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words (good range).\n`;
    }
    
    return { suggestions, additionalInfo };
  }
  
  export async function getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);
      
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      });
      
      audio.addEventListener('error', (err) => {
        reject(err);
        URL.revokeObjectURL(audio.src);
      });
    });
  }