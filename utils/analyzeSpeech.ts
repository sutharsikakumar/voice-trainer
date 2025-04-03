/**
 * Speech analysis result type
 */
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
  
  /**
   * Analyzes speech based on a transcript
   * @param transcript The transcript text to analyze
   * @param durationSeconds The duration of the audio in seconds
   * @returns Analysis results
   */
  export function analyzeSpeech(transcript: string, durationSeconds: number): SpeechAnalysis {
    // Clean the transcript for analysis
    const cleanTranscript = transcript.trim();
    
    // Split into words for analysis
    const words = cleanTranscript.split(/\s+/);
    const wordCount = words.length;
    
    // Calculate words per minute
    const wpm = Math.round((wordCount / durationSeconds) * 60);
    
    // Analyze filler words
    const fillerWordsList = ["um", "uh", "like", "you know", "so", "actually", "basically", "literally"];
    const fillerWordsCount: Record<string, number> = {};
    let totalFillerWords = 0;
    
    // Count each filler word
    words.forEach(word => {
      const lowerWord = word.toLowerCase().replace(/[.,?!;:()]/g, '');
      if (fillerWordsList.includes(lowerWord)) {
        fillerWordsCount[lowerWord] = (fillerWordsCount[lowerWord] || 0) + 1;
        totalFillerWords++;
      }
    });
    
    // Calculate filler word percentage
    const fillerPercentage = wordCount > 0 ? (totalFillerWords / wordCount) * 100 : 0;
    
    // Generate suggestions based on analysis
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
    
    // Filler words suggestions
    if (fillerPercentage > 5) {
      suggestions += `You used filler words frequently (${fillerPercentage.toFixed(1)}% of your speech). Try to reduce the use of: ${Object.keys(fillerWordsCount).join(", ")}.\n\n`;
      
      // Add details about most used filler words
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
    
    // Add general speech quality assessment
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
  
  /**
   * Helper function to assess speech quality
   */
  function assessSpeechQuality(transcript: string) {
    const sentenceCount = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const wordCount = transcript.split(/\s+/).length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    let suggestions = "";
    let additionalInfo = "";
    
    // Sentence length analysis
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
  
  /**
   * Calculate audio duration from an audio file blob
   * @param audioBlob The audio blob to analyze
   * @returns Duration in seconds
   */
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