#!/bin/bash

echo "🚀 Starting Acko MER AI Application..."

# Function to start backend
start_backend() {
    echo "📦 Starting Backend..."
    cd backend
    npm start &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"
    cd ..
}

# Function to start frontend
start_frontend() {
    echo "⚛️ Starting Frontend..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    echo "Frontend started with PID: $FRONTEND_PID"
    cd ..
}

# Start both services
start_backend
sleep 5
start_frontend

echo ""
echo "🎉 Application Starting!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:5000"
echo "❤️ Health:   http://localhost:5000/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait
