// =============================================================================
// REPORT CONTROLLER - Profit & Expenditure Management
// =============================================================================
// 
// Based on Sections 5.13 (Profit Management) and 5.14 (Expenditure Management):
// - 5.13.1 Calculate Profit (SRS-113)
// - 5.13.2 Generate Profit Report (SRS-114, 115)
// - 5.14.1 Add Expense (SRS-117)
// - 5.14.2 View Expenses (SRS-118, 119)
// - 5.14.3 Generate Expense Report (SRS-121, 122)
// - 5.14.4 Total Expense Calculation (SRS-124, 125)
// - 5.14.5 Set Budget Limits (SRS-127, 128)
//
// =============================================================================

const { prisma } = require('../config/db');
const { asyncHandler } = require('../middleware/errorMiddleware');

// =============================================================================
// PROFIT MANAGEMENT
// =============================================================================

// @desc    Get profit summary
// @route   GET /api/reports/profit
// @access  Private/Admin
// Based on SRS-113, SRS-114

const getProfitSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'month' } = req.query;

  // Default to current month if no dates provided
  const start = startDate 
    ? new Date(startDate) 
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate 
    ? new Date(endDate) 
    : new Date();

  // Get total income from orders
  const orders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      deliveredAt: {
        gte: start,
        lte: end,
      },
    },
    select: {
      totalAmount: true,
    },
  });

  const totalIncome = orders.reduce(
    (sum, order) => sum + parseFloat(order.totalAmount),
    0
  );

  // Get total expenses
  const expenses = await prisma.expense.aggregate({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
    _sum: { amount: true },
  });

  const totalExpenses = parseFloat(expenses._sum.amount) || 0;

  // Calculate profit (SRS-113: Profit = Total Income - Total Expenses)
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      orderCount: orders.length,
    },
  });
});

// @desc    Generate profit report
// @route   GET /api/reports/profit/detailed
// @access  Private/Admin
// Based on SRS-115

const generateProfitReport = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // Get monthly breakdown
  const monthlyData = [];

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const [orders, expenses] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: 'DELIVERED',
          deliveredAt: { gte: startDate, lte: endDate },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const income = parseFloat(orders._sum.totalAmount) || 0;
    const expense = parseFloat(expenses._sum.amount) || 0;

    monthlyData.push({
      month: month + 1,
      monthName: new Date(year, month).toLocaleString('default', { month: 'long' }),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expense * 100) / 100,
      profit: Math.round((income - expense) * 100) / 100,
      orderCount: orders._count,
    });
  }

  // Calculate yearly totals
  const yearlyTotals = monthlyData.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      profit: acc.profit + m.profit,
      orderCount: acc.orderCount + m.orderCount,
    }),
    { income: 0, expenses: 0, profit: 0, orderCount: 0 }
  );

  res.status(200).json({
    success: true,
    data: {
      year: parseInt(year),
      monthly: monthlyData,
      yearly: {
        ...yearlyTotals,
        profitMargin: yearlyTotals.income > 0 
          ? Math.round((yearlyTotals.profit / yearlyTotals.income) * 10000) / 100 
          : 0,
      },
    },
  });
});

// =============================================================================
// EXPENSE MANAGEMENT
// =============================================================================

// @desc    Add expense
// @route   POST /api/reports/expenses
// @access  Private/Admin
// Based on SRS-117

const addExpense = asyncHandler(async (req, res) => {
  const { category, amount, description, date, receiptUrl, isRecurring } = req.body;

  if (!category || !amount || !description || !date) {
    res.status(400);
    throw new Error('Category, amount, description, and date are required');
  }

  const expense = await prisma.expense.create({
    data: {
      adminId: req.user.id,
      category,
      amount: parseFloat(amount),
      description,
      date: new Date(date),
      receiptUrl: receiptUrl || null,
      isRecurring: isRecurring || false,
    },
  });

  // Check budget limits (SRS-128)
  await checkBudgetAlert(category, new Date(date));

  res.status(201).json({
    success: true,
    message: 'Expense added successfully',
    data: expense,
  });
});

// @desc    Get expenses
// @route   GET /api/reports/expenses
// @access  Private/Admin
// Based on SRS-118, SRS-119

const getExpenses = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    category, 
    startDate, 
    endDate,
    sortBy = 'date',
    sortOrder = 'desc'
  } = req.query;

  const where = {};

  if (category) {
    where.category = category;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [expenses, totalCount, totalAmount] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        admin: {
          select: { id: true, name: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: expenses,
    summary: {
      totalAmount: parseFloat(totalAmount._sum.amount) || 0,
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
      totalCount,
    },
  });
});

// @desc    Generate expense report by category
// @route   GET /api/reports/expenses/by-category
// @access  Private/Admin
// Based on SRS-121, SRS-122

const getExpensesByCategory = asyncHandler(async (req, res) => {
  const { month, year = new Date().getFullYear() } = req.query;

  const where = {};
  
  if (month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    where.date = { gte: startDate, lte: endDate };
  } else {
    // Full year
    where.date = {
      gte: new Date(year, 0, 1),
      lte: new Date(year, 11, 31),
    };
  }

  const categoryBreakdown = await prisma.expense.groupBy({
    by: ['category'],
    where,
    _sum: { amount: true },
    _count: true,
  });

  const totalExpenses = categoryBreakdown.reduce(
    (sum, cat) => sum + parseFloat(cat._sum.amount),
    0
  );

  const formattedBreakdown = categoryBreakdown.map(cat => ({
    category: cat.category,
    amount: parseFloat(cat._sum.amount) || 0,
    count: cat._count,
    percentage: totalExpenses > 0 
      ? Math.round((parseFloat(cat._sum.amount) / totalExpenses) * 10000) / 100 
      : 0,
  }));

  res.status(200).json({
    success: true,
    data: {
      period: month ? `${year}-${month}` : `${year}`,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      byCategory: formattedBreakdown.sort((a, b) => b.amount - a.amount),
    },
  });
});

// @desc    Get total expenses calculation
// @route   GET /api/reports/expenses/total
// @access  Private/Admin
// Based on SRS-124, SRS-125

const getTotalExpenses = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const where = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const result = await prisma.expense.aggregate({
    where,
    _sum: { amount: true },
    _count: true,
    _avg: { amount: true },
  });

  res.status(200).json({
    success: true,
    data: {
      totalExpenses: parseFloat(result._sum.amount) || 0,
      expenseCount: result._count,
      averageExpense: parseFloat(result._avg.amount) || 0,
    },
  });
});

// =============================================================================
// BUDGET MANAGEMENT
// =============================================================================

// @desc    Set budget limit
// @route   POST /api/reports/budgets
// @access  Private/Admin
// Based on SRS-127

const setBudget = asyncHandler(async (req, res) => {
  const { category, limitAmount, month, year } = req.body;

  if (!category || !limitAmount || !month || !year) {
    res.status(400);
    throw new Error('Category, limit amount, month, and year are required');
  }

  const budget = await prisma.budget.upsert({
    where: {
      category_month_year: {
        category,
        month: parseInt(month),
        year: parseInt(year),
      },
    },
    update: {
      limitAmount: parseFloat(limitAmount),
    },
    create: {
      category,
      limitAmount: parseFloat(limitAmount),
      month: parseInt(month),
      year: parseInt(year),
    },
  });

  res.status(200).json({
    success: true,
    message: 'Budget set successfully (SRS-127)',
    data: budget,
  });
});

// @desc    Get budgets
// @route   GET /api/reports/budgets
// @access  Private/Admin

const getBudgets = asyncHandler(async (req, res) => {
  const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = req.query;

  const budgets = await prisma.budget.findMany({
    where: {
      month: parseInt(month),
      year: parseInt(year),
    },
  });

  // Get actual spending for each category
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const spending = await prisma.expense.groupBy({
    by: ['category'],
    where: {
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  const spendingMap = new Map(
    spending.map(s => [s.category, parseFloat(s._sum.amount)])
  );

  const budgetsWithSpending = budgets.map(budget => {
    const spent = spendingMap.get(budget.category) || 0;
    const remaining = parseFloat(budget.limitAmount) - spent;
    const percentage = (spent / parseFloat(budget.limitAmount)) * 100;

    return {
      ...budget,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      status: percentage >= 100 ? 'EXCEEDED' : percentage >= 80 ? 'WARNING' : 'OK',
    };
  });

  res.status(200).json({
    success: true,
    data: budgetsWithSpending,
  });
});

// =============================================================================
// DASHBOARD SUMMARY
// =============================================================================

// @desc    Get dashboard summary
// @route   GET /api/reports/dashboard
// @access  Private/Admin

const getDashboardSummary = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));

  const [
    totalOrders,
    pendingOrders,
    monthlyRevenue,
    monthlyExpenses,
    newUsers,
    lowStockCount,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      where: {
        status: 'DELIVERED',
        deliveredAt: { gte: startOfMonth },
      },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.product.count({
      where: { isActive: true, stock: { lte: 10 } },
    }),
  ]);

  const revenue = parseFloat(monthlyRevenue._sum.totalAmount) || 0;
  const expenses = parseFloat(monthlyExpenses._sum.amount) || 0;

  res.status(200).json({
    success: true,
    data: {
      totalOrders,
      pendingOrders,
      monthlyRevenue: Math.round(revenue * 100) / 100,
      monthlyExpenses: Math.round(expenses * 100) / 100,
      monthlyProfit: Math.round((revenue - expenses) * 100) / 100,
      newUsersThisMonth: newUsers,
      lowStockAlerts: lowStockCount,
    },
  });
});

// =============================================================================
// HELPER: Check Budget Alert
// =============================================================================
// Based on SRS-128: Budget alerts at 80%, 90%, 100%

const checkBudgetAlert = async (category, date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const budget = await prisma.budget.findUnique({
    where: {
      category_month_year: { category, month, year },
    },
  });

  if (!budget) return;

  // Calculate current spending
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const spending = await prisma.expense.aggregate({
    where: {
      category,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  const spent = parseFloat(spending._sum.amount) || 0;
  const percentage = (spent / parseFloat(budget.limitAmount)) * 100;

  // Check thresholds and update alert status
  if (percentage >= 100 && !budget.alertSent100) {
    console.log(`🚨 BUDGET ALERT: ${category} has exceeded 100% of budget!`);
    await prisma.budget.update({
      where: { id: budget.id },
      data: { alertSent100: true },
    });
  } else if (percentage >= 90 && !budget.alertSent90) {
    console.log(`⚠️ BUDGET WARNING: ${category} is at 90% of budget!`);
    await prisma.budget.update({
      where: { id: budget.id },
      data: { alertSent90: true },
    });
  } else if (percentage >= 80 && !budget.alertSent80) {
    console.log(`📊 BUDGET NOTICE: ${category} is at 80% of budget!`);
    await prisma.budget.update({
      where: { id: budget.id },
      data: { alertSent80: true },
    });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getProfitSummary,
  generateProfitReport,
  addExpense,
  getExpenses,
  getExpensesByCategory,
  getTotalExpenses,
  setBudget,
  getBudgets,
  getDashboardSummary,
};
