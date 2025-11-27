import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const SessionList = ({ sessions = [], loading = false, onSessionSelect }) => {
  const navigate = useNavigate();

  const handleSessionClick = (session) => {
    if (onSessionSelect) {
      onSessionSelect(session);
    }
    navigate(`/sessions/${session._id}`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        All Sessions
      </Typography>
      
      <Button
        variant="contained"
        onClick={() => navigate('/')}
        sx={{ mb: 3 }}
      >
        Back to Main Interface
      </Button>

      {sessions.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" align="center">
              No sessions found
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Start your first consultation session from the main interface.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <List>
          {sessions.map((session) => (
            <ListItem
              key={session._id}
              sx={{ mb: 2, p: 0 }}
            >
              <Card 
                sx={{ width: '100%', cursor: 'pointer' }}
                onClick={() => handleSessionClick(session)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">
                      {session.doctorName}
                    </Typography>
                    <Chip 
                      label={session.status} 
                      color={getStatusColor(session.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Session ID: {session.sessionId}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Type: {session.sessionType} | Priority: {session.priority}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    Started: {formatDate(session.startTime)}
                  </Typography>
                  
                  {session.endTime && (
                    <Typography variant="body2" color="text.secondary">
                      Ended: {formatDate(session.endTime)}
                    </Typography>
                  )}
                  
                  {session.duration && (
                    <Typography variant="body2" color="text.secondary">
                      Duration: {session.duration} minutes
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SessionList;
