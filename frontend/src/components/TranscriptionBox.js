import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Upload as UploadIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const TranscriptionBox = ({ 
  sessionId, 
  transcriptions, 
  onTranscriptionUpdate, 
  isSessionActive 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [currentRecordingId, setCurrentRecordingId] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const audioChunks = useRef([]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (sessionId) {
      // Connect to backend Socket.IO server
      socketRef.current = io('http://localhost:5000');
      
      // Join the session room
      socketRef.current.emit('join-session', sessionId);
      
      // Listen for transcription completion
      socketRef.current.on('transcription-completed', (data) => {
        console.log('Received transcription update:', data);
        
        // Update the transcription in the list
        onTranscriptionUpdate(prev => 
          prev.map(t => 
            t.transcriptionId === data.transcriptionId 
              ? { 
                  ...t, 
                  transcriptionText: data.text,
                  status: 'completed',
                  confidence: data.confidence 
                }
              : t
          )
        );
        
        toast.success('Transcription completed!');
      });

      // Listen for transcription failures
      socketRef.current.on('transcription-failed', (data) => {
        console.log('Received transcription failure:', data);
        
        // Update the transcription status to failed
        onTranscriptionUpdate(prev => 
          prev.map(t => 
            t.transcriptionId === data.transcriptionId 
              ? { 
                  ...t, 
                  transcriptionText: `Error: ${data.error}`,
                  status: 'failed'
                }
              : t
          )
        );
        
        toast.error(`Transcription failed: ${data.error}`);
      });

      // Listen for live transcription updates
      socketRef.current.on('live-transcription', (data) => {
        console.log('Received live transcription:', data);
        if (data.transcriptionId === currentRecordingId) {
          setLiveTranscript(data.text);
        }
      });

      // Cleanup on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [sessionId, currentRecordingId, onTranscriptionUpdate]);

  // Start/stop recording
  const toggleRecording = async () => {
    if (!sessionId) {
      toast.error('Please start a session first');
      return;
    }

    if (isRecording) {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        });

        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });
        
        audioChunks.current = [];

        // Generate a unique recording ID for live updates
        const recordingId = `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setCurrentRecordingId(recordingId);
        setLiveTranscript('');

        // Add live transcription placeholder
        const liveTranscriptionEntry = {
          transcriptionId: recordingId,
          transcriptionText: '',
          status: 'recording',
          createdAt: new Date().toISOString(),
          isLive: true
        };
        onTranscriptionUpdate(prev => [...prev, liveTranscriptionEntry]);

        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
            
            // Send audio chunk for live transcription every 2 seconds
            if (audioChunks.current.length >= 2) {
              const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
              await sendLiveAudioChunk(audioBlob, recordingId);
            }
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          
          // Remove live transcription and upload final audio
          onTranscriptionUpdate(prev => prev.filter(t => t.transcriptionId !== recordingId));
          await uploadAudio(audioBlob, 'recording.webm');
          
          // Reset live transcript
          setLiveTranscript('');
          setCurrentRecordingId(null);
          
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start(1000); // Collect data every second for live streaming
        setMediaRecorder(recorder);
        setIsRecording(true);
        toast.success('Recording started');

      } catch (error) {
        toast.error('Failed to access microphone');
        console.error('Recording error:', error);
      }
    }
  };

  // Send audio chunk for live transcription
  const sendLiveAudioChunk = async (audioBlob, recordingId) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `live_${recordingId}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('recordingId', recordingId);
      formData.append('language', selectedLanguage);
      formData.append('isLive', 'true');

      const response = await fetch('/api/transcribe/stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.warn('Live transcription chunk failed:', await response.text());
      }
    } catch (error) {
      console.warn('Live transcription error:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadAudio(file, file.name);
    }
  };

  // Upload audio file
  const uploadAudio = async (audioData, filename) => {
    if (!sessionId) {
      toast.error('Please start a session first');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioData, filename);
      formData.append('sessionId', sessionId);
      formData.append('language', selectedLanguage);

      const response = await fetch('/api/transcribe/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Audio uploaded for transcription');
        
        // Add placeholder transcription that will be updated
        const newTranscription = {
          transcriptionId: data.transcriptionId,
          transcriptionText: 'Processing...',
          status: 'processing',
          createdAt: new Date().toISOString()
        };
        
        onTranscriptionUpdate(prev => [...prev, newTranscription]);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to upload audio');
      }
    } catch (error) {
      toast.error('Failed to upload audio');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Edit transcription
  const startEdit = (transcription) => {
    setEditingId(transcription.transcriptionId);
    setEditText(transcription.transcriptionText);
  };

  const saveEdit = async () => {
    try {
      const response = await fetch(`/api/transcribe/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptionText: editText,
          editedBy: 'doctor'
        }),
      });

      if (response.ok) {
        // Update local state
        onTranscriptionUpdate(prev => 
          prev.map(t => 
            t.transcriptionId === editingId 
              ? { ...t, transcriptionText: editText, isEdited: true }
              : t
          )
        );
        toast.success('Transcription updated');
        setEditingId(null);
        setEditText('');
      } else {
        toast.error('Failed to update transcription');
      }
    } catch (error) {
      toast.error('Failed to update transcription');
      console.error('Edit error:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get localized listening text
  const getListeningText = (langCode) => {
    const listeningTexts = {
      'en': 'Listening...',
      'hi': 'सुन रहा हूँ...',
      'bn': 'শুনছি...',
      'te': 'వింటున్నాను...',
      'mr': 'ऐकत आहे...',
      'ta': 'கேட்கிறேன்...',
      'gu': 'સાંભળી રહ્યો છું...',
      'kn': 'ಕೇಳುತ್ತಿದ್ದೇನೆ...'
    };
    return listeningTexts[langCode] || listeningTexts['en'];
  };

  // Language options
  const languageOptions = [
    { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
    { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳', nativeName: 'हिन्दी' },
    { code: 'bn', name: 'বাংলা (Bengali)', flag: '🇧🇩', nativeName: 'বাংলা' },
    { code: 'te', name: 'తెలుగు (Telugu)', flag: '🇮🇳', nativeName: 'తెలుగు' },
    { code: 'mr', name: 'मराठी (Marathi)', flag: '🇮🇳', nativeName: 'मराठी' },
    { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🇮🇳', nativeName: 'தமிழ்' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)', flag: '🇮🇳', nativeName: 'ગુજરાતી' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', nativeName: 'ಕನ್ನಡ' },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Language Selection */}
      <Box sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Transcription Language</InputLabel>
          <Select
            value={selectedLanguage}
            label="Transcription Language"
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            {languageOptions.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Recording Controls */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant={isRecording ? "contained" : "outlined"}
          color={isRecording ? "error" : "primary"}
          onClick={toggleRecording}
          disabled={!isSessionActive || isUploading}
          startIcon={isRecording ? <MicOffIcon /> : <MicIcon />}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>

        <input
          type="file"
          accept="audio/*"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        
        <Button
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          disabled={!isSessionActive || isUploading}
          startIcon={isUploading ? <CircularProgress size={20} /> : <UploadIcon />}
        >
          {isUploading ? 'Uploading...' : 'Upload Audio'}
        </Button>

        {isRecording && (
          <Chip 
            label="Recording..." 
            color="error" 
            size="small"
            sx={{ animation: 'pulse 2s infinite' }}
          />
        )}
      </Box>

      {/* Live Transcription Display */}
      {isRecording && (
        <Box sx={{ mb: 2 }}>
          <Alert 
            severity="info" 
            sx={{ 
              backgroundColor: '#e3f2fd',
              border: '1px dashed #1976d2',
              '& .MuiAlert-icon': {
                animation: 'pulse 2s infinite'
              }
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              🎤 Live Transcription ({languageOptions.find(l => l.code === selectedLanguage)?.nativeName || 'English'} - Recording...)
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic', minHeight: '20px' }}>
              {liveTranscript || getListeningText(selectedLanguage)}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Transcriptions List */}
      <Paper sx={{ flex: 1, p: 1, overflow: 'auto', maxHeight: 500 }}>
        {!isSessionActive && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Start a session to begin transcription
          </Alert>
        )}

        {transcriptions.length === 0 && isSessionActive && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No transcriptions yet. Start recording or upload an audio file.
          </Typography>
        )}

        <List>
          {transcriptions.map((transcription) => (
            <ListItem
              key={transcription.transcriptionId}
              sx={{ 
                mb: 1, 
                bgcolor: 'background.paper', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(transcription.createdAt)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {transcription.confidence && (
                        <Chip 
                          label={`${transcription.confidence}%`} 
                          size="small" 
                          variant="outlined"
                          color={transcription.confidence > 80 ? 'success' : 'warning'}
                        />
                      )}
                      {transcription.isEdited && (
                        <Chip label="Edited" size="small" color="info" />
                      )}
                      {transcription.status === 'processing' && (
                        <CircularProgress size={16} />
                      )}
                      <IconButton
                        size="small"
                        onClick={() => startEdit(transcription)}
                        disabled={transcription.status === 'processing'}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                }
                secondary={
                  editingId === transcription.transcriptionId ? (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        variant="outlined"
                        size="small"
                      />
                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveEdit}
                          startIcon={<SaveIcon />}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={cancelEdit}
                          startIcon={<CancelIcon />}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mt: 1,
                        fontStyle: transcription.status === 'processing' ? 'italic' : 'normal',
                        color: transcription.status === 'processing' ? 'text.secondary' : 'text.primary'
                      }}
                    >
                      {transcription.transcriptionText}
                    </Typography>
                  )
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default TranscriptionBox;