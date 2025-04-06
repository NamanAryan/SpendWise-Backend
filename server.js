import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import expenseRoutes from './routes/transactionRoute.js';
import userRoute from './routes/userRoute.js';
import streakRoute from './routes/streakRoute.js';
import dashboardRoute from './routes/dashboardRoute.js';
import budgetSummaryRoute from './routes/budgetSummaryRoute.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch(err => console.log('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.send(`Server running at Port ${process.env.PORT}!`);
});

// API routes
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoute);
app.use('/api/streaks', streakRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/budget-summary', budgetSummaryRoute);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});