# Real-Time Chat Application – Backend

## Overview
This is the backend service for a real-time chat application built using Node.js, Express, Socket.io, and MongoDB.  
The backend handles user authentication, chat rooms, message storage, and all real-time chat functionality.

## Features
1. User Authentication  
   Users can register, log in, or join as guest.  
   Passwords are hashed for security.  
   JWT is used for secure API access.

2. Real-Time Chat  
   Messages are sent and received instantly using Socket.io.  
   All users in the same room receive the messages in real time.

3. Chat Rooms  
   Four default rooms are available and cannot be deleted.  
   Users can create additional rooms.  
   User-created rooms can be deleted.

4. Online Users  
   Shows users currently connected in a room.  
   Updates automatically when users join or leave.

5. Typing Indicator  
   Shows when someone is typing in the room.

6. Chat History  
   Messages are stored in MongoDB.  
   When a user joins a room, the latest messages are loaded.


## Project Links
Backend Live URL  
https://real-time-chat-backend-2-dw7c.onrender.com

Frontend Live URL  
https://subtle-fenglisu-cf934c.netlify.app

Backend GitHub Repository  
https://github.com/Vishalaury/real-time-chat-backend

Frontend GitHub Repository  
https://github.com/Vishalaury/chat-frontend
