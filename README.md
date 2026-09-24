# Skill Swap Platform

**Team Name:** Team 1274
**Selected Problem Statement:** Skill Swap Platform

A modern web application that enables users to exchange skills with each other. Users can list their skills, search for others with specific skills, and request skill swaps in return.

## Features

### User Management
- **User Registration & Authentication**: Secure JWT-based authentication
- **Profile Management**: Users can create and edit their profiles
- **Profile Photos**: Optional profile photo uploads
- **Privacy Settings**: Users can make their profiles public or private

### Skill Management
- **Skills Offered**: Users can list skills they can teach
- **Skills Wanted**: Users can list skills they want to learn
- **Skill Details**: Each skill includes description and proficiency/priority levels
- **Availability**: Users can specify when they're available (weekdays, weekends, evenings, mornings)

### Search & Discovery
- **Browse Users**: View all public profiles
- **Skill Search**: Search users by specific skills
- **Location Filtering**: Filter users by location
- **Availability Filtering**: Filter by availability preferences

### Swap Management
- **Request Swaps**: Send skill exchange requests to other users
- **Accept/Reject**: Recipients can accept or reject swap requests
- **Cancel Requests**: Requesters can cancel pending requests
- **Complete Swaps**: Mark swaps as completed after exchange
- **Swap History**: View all past and current swaps

### Rating System
- **Post-Swap Ratings**: Rate completed swaps (1-5 stars)
- **Comments**: Add feedback comments to ratings
- **User Ratings**: Build reputation through ratings
- **Average Ratings**: Display user's average rating

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **multer** for file uploads
- **express-validator** for input validation
- **helmet** for security headers
- **express-rate-limit** for rate limiting

### Frontend
- **React.js** with functional components and hooks
- **React Router** for navigation
- **Axios** for API calls
- **React Hook Form** for form management
- **React Hot Toast** for notifications
- **Lucide React** for icons
- **Tailwind CSS** for styling

## Project Structure

```
skillswap/
├── server/                 # Backend API
│   ├── models/            # MongoDB schemas
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── uploads/           # File uploads
│   └── index.js           # Server entry point
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── index.js       # App entry point
│   └── public/            # Static files
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd skillswap
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd server
   npm install
   
   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**
   
   Copy the template file and customize it with your settings:
   ```bash
   cd server
   cp .env-template .env
   ```
   
   Then edit the `.env` file with your MongoDB Atlas connection string:
   ```env
   MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/skillswap?retryWrites=true&w=majority
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=5000
   NODE_ENV=development
   ```

4. **Start MongoDB**
   
   Make sure MongoDB is running on your system or use a cloud instance.

5. **Run the application**
   
   From the root directory:
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start them separately:
   npm run server  # Backend on port 5000
   npm run client  # Frontend on port 3000
   ```

### Development Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend development server
- `npm run build` - Build the frontend for production
- `npm run install-all` - Install dependencies for all packages

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/browse` - Browse public users
- `GET /api/users/search` - Search users by skills
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/profile-photo` - Upload profile photo
- `POST /api/users/skills-offered` - Add skill offered
- `POST /api/users/skills-wanted` - Add skill wanted
- `DELETE /api/users/skills-offered/:id` - Remove skill offered
- `DELETE /api/users/skills-wanted/:id` - Remove skill wanted

### Swaps
- `POST /api/swaps` - Create swap request
- `GET /api/swaps/my-swaps` - Get user's swaps
- `GET /api/swaps/:id` - Get swap details
- `PUT /api/swaps/:id/accept` - Accept swap request
- `PUT /api/swaps/:id/reject` - Reject swap request
- `PUT /api/swaps/:id/complete` - Complete swap
- `PUT /api/swaps/:id/cancel` - Cancel swap request
- `POST /api/swaps/:id/rate` - Rate completed swap

### Skills
- `GET /api/skills/popular` - Get popular skills
- `GET /api/skills/suggestions` - Get skill suggestions

## Usage

1. **Register/Login**: Create an account or sign in
2. **Complete Profile**: Add your skills, availability, and bio
3. **Browse Users**: Search for people with skills you want to learn
4. **Request Swaps**: Send skill exchange requests
5. **Manage Requests**: Accept, reject, or cancel swap requests
6. **Complete Swaps**: Mark swaps as completed after exchange
7. **Rate & Review**: Provide feedback after completing swaps

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 