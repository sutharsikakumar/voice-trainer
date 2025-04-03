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
  detectedTone?: string; 
}


const toneKeywords = {
  persuasive: ["should", "must", "need", "believe", "act", "convince", "agree"],
  informative: ["explain", "describe", "know", "understand", "learn", "fact", "data"],
  motivational: ["inspire", "achieve", "dream", "hope", "success", "overcome", "believe"],
  casual: ["like", "you know", "just", "stuff", "cool", "whatever"],
  formal: ["therefore", "however", "consequently", "furthermore", "thus", "esteemed"]
};

export function analyzeSpeech(transcript: string, durationSeconds: number, speechType?: string): SpeechAnalysis {
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


  const toneScores: Record<string, number> = {};
  Object.keys(toneKeywords).forEach(tone => toneScores[tone] = 0);

  words.forEach(word => {
    const lowerWord = word.toLowerCase().replace(/[.,?!;:()]/g, '');
    Object.entries(toneKeywords).forEach(([tone, keywords]) => {
      if (keywords.includes(lowerWord)) {
        toneScores[tone] = (toneScores[tone] || 0) + 1;
      }
    });
  });


  const detectedTone = speechType || Object.entries(toneScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";

  let suggestions = "";
  let additionalInfo = `Detected Tone: ${detectedTone}\n`;


  if (wpm < 120) {
    suggestions += `Your speaking pace is a bit slow at ${wpm} words per minute. For a${detectedTone === "motivational" ? "n engaging" : ""} ${detectedTone} speech, consider speaking slightly faster to maintain audience engagement.\n\n`;
  } else if (wpm > 160) {
    suggestions += `Your speaking pace is quite fast at ${wpm} words per minute. For a${detectedTone === "informative" ? " clear" : ""} ${detectedTone} speech, try slowing down slightly for better clarity.\n\n`;
  } else {
    suggestions += `Your speaking pace is good at ${wpm} words per minute for a ${detectedTone} speech.\n\n`;
  }


  if (fillerPercentage > 5) {
    suggestions += `You used filler words frequently (${fillerPercentage.toFixed(1)}% of your speech). In a ${detectedTone} speech, reducing fillers (${Object.keys(fillerWordsCount).join(", ")}) will enhance credibility${detectedTone === "formal" ? " and professionalism" : ""}.\n\n`;
    additionalInfo += "Most used filler words:\n" +
      Object.entries(fillerWordsCount)
        .sort((a, b) => b[1] - a[1])
        .map(([word, count]) => `- "${word}": ${count} times`)
        .join("\n") + "\n";
  } else if (totalFillerWords > 0) {
    suggestions += `You used filler words occasionally (${fillerPercentage.toFixed(1)}% of your speech). For a stronger ${detectedTone} delivery, consider further reducing: ${Object.keys(fillerWordsCount).join(", ")}.\n\n`;
  } else {
    suggestions += `Great job avoiding filler words, enhancing your ${detectedTone} speech!\n\n`;
  }

  const speechQuality = assessSpeechQuality(cleanTranscript, detectedTone);
  suggestions += speechQuality.suggestions;
  additionalInfo += speechQuality.additionalInfo;

  return {
    transcript: cleanTranscript,
    wpm,
    fillerWords: {
      count: totalFillerWords,
      percentage: fillerPercentage,
      words: fillerWordsCount
    },
    suggestions,
    additionalInfo,
    detectedTone
  };
}

function assessSpeechQuality(transcript: string, tone: string) {
  const sentenceCount = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const wordCount = transcript.split(/\s+/).length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  let suggestions = "";
  let additionalInfo = "";


  if (avgWordsPerSentence > 25) {
    suggestions += `Your sentences are lengthy (${avgWordsPerSentence.toFixed(1)} words). For a ${tone} speech, shorter sentences can improve${tone === "informative" ? " comprehension" : " impact"}.\n\n`;
    additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words (recommended: 15-20 words).\n`;
  } else if (avgWordsPerSentence < 10 && sentenceCount > 3) {
    suggestions += `Your sentences are quite short (${avgWordsPerSentence.toFixed(1)} words). In a ${tone} speech, try varying sentence length for better${tone === "motivational" ? " engagement" : " flow"}.\n\n`;
    additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words.\n`;
  } else {
    additionalInfo += `Average sentence length: ${avgWordsPerSentence.toFixed(1)} words (good range for ${tone} tone).\n`;
  }


  switch (tone) {
    case "persuasive":
      suggestions += "To enhance your persuasive tone, incorporate stronger calls to action (e.g., 'we must act now') and repeat key arguments.\n\n";
      break;
    case "informative":
      suggestions += "For a clearer informative tone, include specific examples or statistics to reinforce your points.\n\n";
      break;
    case "motivational":
      suggestions += "To boost your motivational tone, use vivid, positive language and personal stories to connect with the audience.\n\n";
      break;
    case "casual":
      suggestions += "Your casual tone is relatable, but avoid excessive informality to maintain authority.\n\n";
      break;
    case "formal":
      suggestions += "Maintain your formal tone by using precise terms and avoiding casual phrases or contractions.\n\n";
      break;
    default:
      suggestions += "No specific tone detected. Define your speech’s intent for more tailored feedback.\n\n";
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