
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';  // Import your User model

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user from database and attach to request
            req.user = await User.findById(decoded.id);
            
            // Log for debugging
            console.log('Auth user from DB:', req.user);

            next();
        } catch (error) {
            res.status(401).json({message: 'Not authorized, token failed'});
        }
    } else {
        res.status(401).json({message: 'Not authorized, no token'});
    }
};

export default protect;