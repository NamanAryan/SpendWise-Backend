import express from "express";
import Expense from "../models/transaction.model.js";
import User from "../models/user.model.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get total expenses
    const totalExpensesAgg = await Expense.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: "$Amount" } } }
    ]);

    const totalExpenses = totalExpensesAgg.length > 0 ? totalExpensesAgg[0].total : 0;

    // Assuming income is fixed or handled differently, here we set it to 0 or you can derive from another model
    const income = 0;

    const balance = user.balance;
    const savings = balance - totalExpenses;

    res.json({
      income,
      expenses: totalExpenses,
      savings,
      totalBalance: balance
    });
  } catch (err) {
    console.error("Error fetching budget summary:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
