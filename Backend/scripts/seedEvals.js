import 'dotenv/config';
import mongoose from 'mongoose';
import EvalCase from '../models/EvalCase.js';

// Replace this with your actual SafarSetu repoId from MongoDB
const SAFER_SETU_REPO_ID = '6a48a056ee579f3afd2bab95';
const SAFER_SETU_FULL_NAME = 'Biswajit1progit/SAFER-SETU';

const retrievalEvals = [
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is token verification middleware',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/middleware/authMiddleware.js'],
      relevantFunctions: ['verifyToken'],
    },
    tags: ['auth', 'middleware'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'how does booking race condition prevention work',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/bookingController.js'],
      relevantFunctions: ['createBooking'],
    },
    tags: ['booking', 'concurrency'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is Razorpay payment verification done',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/paymentController.js'],
      relevantFunctions: ['verifyPayment', 'getRazorpayClient'],
    },
    tags: ['payment', 'security'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is user authentication login implemented',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/authController.js'],
      relevantFunctions: ['login', 'getProfile'],
    },
    tags: ['auth', 'login'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is hotel search implemented',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/hotelController.js'],
      relevantFunctions: ['searchHotels', 'getHotelsByDistrict'],
    },
    tags: ['hotel', 'search'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where are auth routes defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/routes/authRoutes.js'],
      relevantFunctions: ['authRoutes'],
    },
    tags: ['auth', 'routes'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is email sending implemented',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/emailController.js'],
      relevantFunctions: ['emailController'],
    },
    tags: ['email', 'notifications'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'how are reviews and ratings calculated',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/reviewController.js'],
      relevantFunctions: ['addReview', 'getUpdatedRatingFields'],
    },
    tags: ['reviews', 'ratings'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is hotel model schema defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/models/hotel.js'],
      relevantFunctions: ['hotel'],
    },
    tags: ['hotel', 'schema'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    retrieval: {
      query: 'where is booking creation handled',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/bookingController.js'],
      relevantFunctions: ['createBooking'],
    },
    tags: ['booking'],
    createdBy: 'manual',
  },
];

const reviewEvals = [
  {
    type: 'review',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 999,
      prTitle: 'Add booking status comment',
      prDescription: 'Adds a comment explaining the new booking status field',
      diff: `
+  // ther is new booking status
   const status = booking.status;
      `,
      groundTruth: {
        shouldCatch: [
          'typo in comment: "ther is" should be "there is a"',
          'comment is vague — does not explain what the new status is or its valid values',
          'no actual implementation of the new status, just a comment',
        ],
        shouldNotFlag: [
          'const usage is correct',
          'reading booking.status is correct pattern',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['documentation', 'typo'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 998,
      prTitle: 'Add admin route without auth check',
      prDescription: 'Adds a new admin endpoint to delete all bookings',
      diff: `
+router.delete('/admin/bookings/all', async (req, res) => {
+  await Booking.deleteMany({});
+  res.json({ message: 'All bookings deleted' });
+});
      `,
      groundTruth: {
        shouldCatch: [
          'no authentication middleware — any user can call this endpoint',
          'no authorization check — should be admin only',
          'deleteMany with empty filter deletes ALL documents — catastrophic if called accidentally',
          'no confirmation step or soft-delete — irreversible operation',
        ],
        shouldNotFlag: [
          'async/await pattern is correct',
          'response format matches existing patterns',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['security', 'auth', 'critical'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 997,
      prTitle: 'Fix typo in variable name',
      prDescription: 'Renames hotelOwenr to hotelOwner throughout the file',
      diff: `
-const hotelOwenr = await User.findById(req.user.id);
+const hotelOwner = await User.findById(req.user.id);
      `,
      groundTruth: {
        shouldCatch: [],
        shouldNotFlag: [
          'rename is correct',
          'no logic change',
          'User.findById pattern is correct',
        ],
        expectedVerdict: 'APPROVE',
      },
    },
    tags: ['refactor', 'typo'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 996,
      prTitle: 'Add hotel search by price range',
      prDescription: 'Adds min/max price filter to hotel search endpoint',
      diff: `
+const { minPrice, maxPrice } = req.query;
+const filter = {};
+if (minPrice) filter.price = { $gte: minPrice };
+if (maxPrice) filter.price = { ...filter.price, $lte: maxPrice };
+const hotels = await Hotel.find(filter);
      `,
      groundTruth: {
        shouldCatch: [
          'minPrice and maxPrice are strings from req.query — not converted to Number before comparison with $gte/$lte',
          'no validation that minPrice < maxPrice',
          'no upper bound on maxPrice — could be used to enumerate all hotels',
        ],
        shouldNotFlag: [
          'filter object pattern is correct',
          'spread operator usage is correct',
          'Hotel.find pattern matches existing codebase',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'type-coercion', 'validation'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 995,
      prTitle: 'Add error handling to payment route',
      prDescription: 'Wraps payment verification in try-catch',
      diff: `
+try {
   const isValid = verifyPaymentSignature(req.body);
+  if (!isValid) return res.status(400).json({ message: 'Invalid signature' });
   await Payment.create({ ...req.body, status: 'success' });
   res.json({ message: 'Payment verified' });
+} catch (err) {
+  console.error(err);
+  res.status(500).json({ message: 'Payment verification failed' });
+}
      `,
      groundTruth: {
        shouldCatch: [
          'console.error logs the full error object which may contain sensitive payment data',
          'error message to client is generic which is good, but internal logging needs sanitization',
        ],
        shouldNotFlag: [
          'try-catch pattern is correct',
          'signature verification before DB write is correct order',
          '400 for invalid signature is correct status code',
          '500 for unexpected errors is correct',
        ],
        expectedVerdict: 'COMMENT',
      },
    },
    tags: ['error-handling', 'security', 'payment'],
    createdBy: 'manual',
  },
];

const seedEvals = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  // Clear existing eval cases
  await EvalCase.deleteMany({});
  console.log('Cleared existing eval cases');

  // Insert retrieval evals
  await EvalCase.insertMany(retrievalEvals);
  console.log(`Inserted ${retrievalEvals.length} retrieval eval cases`);

  // Insert review evals
  await EvalCase.insertMany(reviewEvals);
  console.log(`Inserted ${reviewEvals.length} review eval cases`);

  console.log('\n✅ Eval dataset seeded successfully');
  console.log(`Total: ${retrievalEvals.length + reviewEvals.length} eval cases`);

  await mongoose.disconnect();
};

seedEvals().catch(console.error);