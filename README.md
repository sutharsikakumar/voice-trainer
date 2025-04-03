Deployed on Vercel: [voice-trainer-zeta.vercel.app](url)

This is a speech trainer. You can start by uploading or recording an audio segment that will be transcribed using Whisper API and analyzed based on how well it was delivered. Suggestions for improvement will be displayed to the right side. Multiple attempts can be practiced by going back to the home page and re-uploading or re-recording.

<img width="1440" alt="Screenshot 2025-04-03 at 1 25 27 PM" src="https://github.com/user-attachments/assets/c6b25f82-f627-4852-9838-73db080d3941" />


There are also things to improve upon, such as the words per minute calculation (does not work if under 1 minute speech), and making the analysis more robust in general. Currently, only very rudimentary calculations are being performed. 

<img width="1440" alt="Screenshot 2025-04-03 at 1 25 21 PM" src="https://github.com/user-attachments/assets/faf83dc6-2f99-49be-a30f-b12269fc5a37" />


Future Work:
1) Currently the Supabase storage is public, which means everyone can access the audio files, in a real-world application this would not be feaseable. Addressing this issue immediately is crucial. 
2) Making the analysis more personalized, and being able to account for gaps and pauses but not so much that it gets in the way of the delivery of the speech? The algorithm for this would be really cool to implement.
3) Providing a place where users can upload presentations/posters so that a computer vision component and voice AI can interact to develop better analyses/feedback. All of this would be really cool to implement.


But at least its a start, and it works (hopefully)!
