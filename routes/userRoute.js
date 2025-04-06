    import User from '../models/user.model.js';
    import { Router } from 'express';
    import protect from '../middleware/auth.middleware.js';
    const router = Router();
    import jwt from 'jsonwebtoken';

    router.post('/register', async (req, res) => {
        const { fullName, email, password } = req.body;
        try {
            if (!fullName || !email || !password) {
                return res.status(400).json({ 
                    message: 'Please provide all required fields' 
                });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    message: 'Please provide a valid email' 
                });
            }

            const userExists = await User.findOne({ email: email.toLowerCase() });
            if (userExists) {
                return res.status(400).json({ 
                    message: 'User already exists' 
                });
            }

            const user = await User.create({
                fullName,
                email: email.toLowerCase(),
                password
            });

            const userResponse = {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                balance: user.balance || 0 
            };
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.status(201).json({ success: true, user: userResponse, token });
        
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ 
                success: false,
                message: 'Registration failed' 
            });
        }
    });

    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isPasswordMatch = await user.matchpasswords(password);
            if (!isPasswordMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const userResponse = {
                id: user.id,
                fullName: user.fullName,
                email: user.email
            };
        
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
                expiresIn: '30d' 
            });

            res.status(200).json({ 
                success: true, 
                user: userResponse, 
                token 
            });
        } catch (error) {  
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred during login'
            });
        }
    });

    router.get('/profile', protect, async (req, res) => {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.status(200).json({ success: true, user });
        } catch (error) {
            console.error('Profile error:', error);
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    });

    router.put('/profile', protect, async (req, res) => {
        try {
            const userId = req.user.id;
            const { fullName, email, phone, address } = req.body;
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    fullName,
                    email,
                    phone,
                    address
                },
                { new: true } 
            );

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.status(200).json({
                success: true,
                user: updatedUser
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'An unexpected error occurred'
            });
        }
    });

    export default router;