import 'dotenv/config';
import mongoose from 'mongoose';
import EvalCase from '../models/EvalCase.js';

const SAFER_SETU_REPO_ID = '6a48a056ee579f3afd2bab95';
const SAFER_SETU_FULL_NAME = 'Biswajit1progit/SAFER-SETU';

// ── 30 RETRIEVAL EVAL CASES ──────────────────────────────────

const retrievalEvals = [
  // AUTH (5 cases)
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'auth',
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
    difficulty: 'easy',
    category: 'auth',
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
    difficulty: 'easy',
    category: 'auth',
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
    difficulty: 'medium',
    category: 'auth',
    retrieval: {
      query: 'how is user session managed after login',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/middleware/authMiddleware.js'],
      relevantFunctions: ['verifyToken', 'getToken'],
    },
    tags: ['auth', 'session'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'auth',
    retrieval: {
      query: 'where is user profile data fetched',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/authController.js'],
      relevantFunctions: ['getProfile'],
    },
    tags: ['auth', 'profile'],
    createdBy: 'manual',
  },

  // BOOKING (5 cases)
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'booking',
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
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'booking',
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
    difficulty: 'medium',
    category: 'booking',
    retrieval: {
      query: 'how does a user get their booking history',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/bookingController.js'],
      relevantFunctions: ['getUserBookings'],
    },
    tags: ['booking', 'history'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'booking',
    retrieval: {
      query: 'where is booking model schema defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/models/Booking.js'],
      relevantFunctions: ['Booking'],
    },
    tags: ['booking', 'schema'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'booking',
    retrieval: {
      query: 'where are booking routes registered',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/routes/bookingRoutes.js'],
      relevantFunctions: ['bookingRoutes'],
    },
    tags: ['booking', 'routes'],
    createdBy: 'manual',
  },

  // PAYMENT (4 cases)
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'payment',
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
    difficulty: 'medium',
    category: 'payment',
    retrieval: {
      query: 'where is payment model schema defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/models/Payment.js'],
      relevantFunctions: ['Payment'],
    },
    tags: ['payment', 'schema'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'payment',
    retrieval: {
      query: 'how is payment signature verified to prevent tampering',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/utils/verifySignature.js'],
      relevantFunctions: ['verifySignature'],
    },
    tags: ['payment', 'security', 'hmac'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'payment',
    retrieval: {
      query: 'where are payment routes defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/routes/paymentRoutes.js'],
      relevantFunctions: ['paymentRoutes'],
    },
    tags: ['payment', 'routes'],
    createdBy: 'manual',
  },

  // HOTEL (4 cases)
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'hotel',
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
    difficulty: 'medium',
    category: 'hotel',
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
    difficulty: 'hard',
    category: 'hotel',
    retrieval: {
      query: 'how is hotel average rating calculated and updated',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/hotelController.js'],
      relevantFunctions: ['withComputedRating'],
    },
    tags: ['hotel', 'rating'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'hotel',
    retrieval: {
      query: 'where are hotel routes registered',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/routes/hotelRoutes.js'],
      relevantFunctions: ['hotelRoutes'],
    },
    tags: ['hotel', 'routes'],
    createdBy: 'manual',
  },

  // REVIEW (3 cases)
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'review',
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
    difficulty: 'easy',
    category: 'review',
    retrieval: {
      query: 'where is review model schema defined',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/models/Revie.js'],
      relevantFunctions: ['Review'],
    },
    tags: ['reviews', 'schema'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'review',
    retrieval: {
      query: 'where are review routes registered',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/routes/reviewRoutes.js'],
      relevantFunctions: ['reviewRoutes'],
    },
    tags: ['reviews', 'routes'],
    createdBy: 'manual',
  },

  // EMAIL/NOTIFICATION (3 cases)
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'notification',
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
    difficulty: 'medium',
    category: 'notification',
    retrieval: {
      query: 'how is invoice email generated and sent',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/utils/sendInvoiceEmail.js'],
      relevantFunctions: ['sendInvoiceEmail'],
    },
    tags: ['email', 'invoice'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'notification',
    retrieval: {
      query: 'where is mail configuration set up',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/congfig/mail.js'],
      relevantFunctions: ['mail'],
    },
    tags: ['email', 'config'],
    createdBy: 'manual',
  },

  // EDGE CASES (6 cases)
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'security',
    retrieval: {
      query: 'where is input validation done before database operations',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/middleware/authMiddleware.js'],
      relevantFunctions: ['verifyToken'],
    },
    tags: ['security', 'validation'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'performance',
    retrieval: {
      query: 'how does database connection pooling work',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/congfig/db.js'],
      relevantFunctions: ['db'],
    },
    tags: ['performance', 'database'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'medium',
    category: 'refactor',
    retrieval: {
      query: 'where is PDF invoice generation implemented',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/utils/generateInvoicePDF.js'],
      relevantFunctions: ['generateInvoicePDF'],
    },
    tags: ['pdf', 'invoice'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'easy',
    category: 'refactor',
    retrieval: {
      query: 'where is order id generation utility',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/utils/generateOrderId.js'],
      relevantFunctions: ['generateOrderId'],
    },
    tags: ['utility', 'order'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'multi-file',
    retrieval: {
      query: 'how does the complete payment flow work from order creation to verification',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/controllers/paymentController.js', 'Backend/utils/verifySignature.js'],
      relevantFunctions: ['getRazorpayClient', 'verifyPayment', 'verifySignature'],
    },
    tags: ['payment', 'multi-file', 'flow'],
    createdBy: 'manual',
  },
  {
    type: 'retrieval',
    difficulty: 'hard',
    category: 'edge-case',
    retrieval: {
      query: 'how is server entry point configured and started',
      repoId: SAFER_SETU_REPO_ID,
      repoFullName: SAFER_SETU_FULL_NAME,
      relevantFiles: ['Backend/serve.js'],
      relevantFunctions: ['serve'],
    },
    tags: ['server', 'config', 'edge-case'],
    createdBy: 'manual',
  },
];

// ── 20 REVIEW EVAL CASES ─────────────────────────────────────

const reviewEvals = [
  // ORIGINAL 5 (kept)
  {
    type: 'review',
    difficulty: 'easy',
    category: 'style',
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
    difficulty: 'hard',
    category: 'security',
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
    difficulty: 'easy',
    category: 'refactor',
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
    difficulty: 'medium',
    category: 'bug',
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
          'minPrice and maxPrice are strings from req.query — not converted to Number before comparison',
          'no validation that minPrice < maxPrice',
          'no upper bound on maxPrice',
        ],
        shouldNotFlag: [
          'filter object pattern is correct',
          'spread operator usage is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'type-coercion', 'validation'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'security',
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
          'error message to client is generic which is good but internal logging needs sanitization',
        ],
        shouldNotFlag: [
          'try-catch pattern is correct',
          'signature verification before DB write is correct order',
          '400 for invalid signature is correct status code',
        ],
        expectedVerdict: 'COMMENT',
      },
    },
    tags: ['error-handling', 'security', 'payment'],
    createdBy: 'manual',
  },

  // NEW 15 CASES

  // SECURITY CASES (4)
  {
    type: 'review',
    difficulty: 'hard',
    category: 'security',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 994,
      prTitle: 'Add user lookup by email in public route',
      prDescription: 'Adds endpoint to check if email exists',
      diff: `
+router.get('/check-email', async (req, res) => {
+  const { email } = req.query;
+  const user = await User.findOne({ email });
+  res.json({ exists: !!user, userId: user?._id });
+});
      `,
      groundTruth: {
        shouldCatch: [
          'exposes userId in response — user enumeration vulnerability',
          'no rate limiting — can be used to enumerate all registered emails',
          'no auth check — any unauthenticated user can call this',
          'should return only { exists: boolean } without any user data',
        ],
        shouldNotFlag: [
          'User.findOne pattern is correct',
          'async/await usage is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['security', 'enumeration', 'idor'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'hard',
    category: 'security',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 993,
      prTitle: 'Store payment details in localStorage',
      prDescription: 'Caches payment info for faster checkout',
      diff: `
+localStorage.setItem('paymentDetails', JSON.stringify({
+  cardNumber: formData.cardNumber,
+  cvv: formData.cvv,
+  expiry: formData.expiry
+}));
      `,
      groundTruth: {
        shouldCatch: [
          'storing card number and CVV in localStorage is a critical security vulnerability',
          'localStorage is accessible by any JS running on the page — XSS risk',
          'PCI-DSS compliance violation — card data must never be stored client-side',
          'CVV must never be stored anywhere per card network rules',
        ],
        shouldNotFlag: [
          'JSON.stringify usage is correct syntax',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['security', 'payment', 'pci', 'critical'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'security',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 992,
      prTitle: 'Add booking cancellation endpoint',
      prDescription: 'Allows users to cancel their bookings',
      diff: `
+router.post('/cancel/:bookingId', verifyToken, async (req, res) => {
+  const booking = await Booking.findById(req.params.bookingId);
+  booking.status = 'cancelled';
+  await booking.save();
+  res.json({ message: 'Booking cancelled' });
+});
      `,
      groundTruth: {
        shouldCatch: [
          'no ownership check — any authenticated user can cancel any booking (IDOR)',
          'no check if booking belongs to req.user — should use findOne({ _id, userId: req.user.id })',
          'no null check on booking — will crash if booking not found',
          'no check if booking is already cancelled or completed',
        ],
        shouldNotFlag: [
          'verifyToken middleware is correctly applied',
          'async/await pattern is correct',
          'response format is fine',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['security', 'idor', 'booking'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'security',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 991,
      prTitle: 'Add search with regex filter',
      prDescription: 'Enables text search on hotel names',
      diff: `
+const { query } = req.query;
+const hotels = await Hotel.find({
+  name: { $regex: query, $options: 'i' }
+});
      `,
      groundTruth: {
        shouldCatch: [
          'unescaped regex from user input — ReDoS (Regular Expression Denial of Service) vulnerability',
          'no input validation or sanitization before using in regex',
          'malicious regex like (a+)+ can cause catastrophic backtracking',
          'should use $text index or escape the query before using as regex',
        ],
        shouldNotFlag: [
          '$options i for case insensitive is correct syntax',
          'Hotel.find pattern is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['security', 'regex', 'dos'],
    createdBy: 'manual',
  },

  // BUG CASES (4)
  {
    type: 'review',
    difficulty: 'medium',
    category: 'bug',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 990,
      prTitle: 'Add discount calculation to booking',
      prDescription: 'Applies percentage discount to booking total',
      diff: `
+const discount = req.body.discountPercent;
+const total = booking.totalAmount;
+const discountedAmount = total - (total * discount / 100);
+booking.finalAmount = discountedAmount;
      `,
      groundTruth: {
        shouldCatch: [
          'discountPercent comes from req.body — user can send any value including negative (increasing price) or >100 (negative price)',
          'no validation that discount is between 0 and 100',
          'no server-side discount validation — discount should come from a promotions table not user input',
          'floating point precision issue — should use Math.round or toFixed for currency',
        ],
        shouldNotFlag: [
          'arithmetic formula is mathematically correct for valid inputs',
          'async/await pattern is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'validation', 'business-logic'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'easy',
    category: 'bug',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 989,
      prTitle: 'Fix date comparison in availability check',
      prDescription: 'Checks if hotel is available for selected dates',
      diff: `
+const checkIn = req.body.checkIn;
+const checkOut = req.body.checkOut;
+if (checkIn > checkOut) {
+  return res.status(400).json({ message: 'Invalid dates' });
+}
      `,
      groundTruth: {
        shouldCatch: [
          'comparing date strings with > not Date objects — string comparison gives wrong results for different date formats',
          'should use new Date(checkIn) > new Date(checkOut)',
          'no validation that dates are valid date strings before comparing',
          'no check that checkIn is not in the past',
        ],
        shouldNotFlag: [
          '400 status for invalid input is correct',
          'early return pattern is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'date', 'validation'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'hard',
    category: 'multi-file',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 988,
      prTitle: 'Add async operations without await',
      prDescription: 'Updates multiple records after booking confirmation',
      diff: `
+router.post('/confirm/:id', verifyToken, async (req, res) => {
+  const booking = await Booking.findById(req.params.id);
+  booking.status = 'confirmed';
+  booking.save();
+  Hotel.findByIdAndUpdate(booking.hotelId, { $inc: { bookedCount: 1 } });
+  sendConfirmationEmail(booking.userId, booking);
+  res.json({ message: 'Booking confirmed' });
+});
      `,
      groundTruth: {
        shouldCatch: [
          'booking.save() is called without await — save may fail silently',
          'Hotel.findByIdAndUpdate called without await — update may not complete before response',
          'sendConfirmationEmail called without await — email may fail silently',
          'no error handling if any of these operations fail',
          'response sent before operations complete — client thinks success but DB may not be updated',
        ],
        shouldNotFlag: [
          'verifyToken middleware is correctly applied',
          '$inc operator syntax is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'async', 'multi-file'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'bug',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 987,
      prTitle: 'Add pagination to hotel listing',
      prDescription: 'Returns paginated hotel results',
      diff: `
+const page = req.query.page;
+const limit = req.query.limit;
+const skip = page * limit;
+const hotels = await Hotel.find({}).skip(skip).limit(limit);
+res.json({ hotels, page, limit });
      `,
      groundTruth: {
        shouldCatch: [
          'page and limit are strings from req.query — multiplying strings gives NaN or wrong result',
          'should use parseInt(req.query.page) || 1 and parseInt(req.query.limit) || 10',
          'no default values — if page/limit not provided, skip is NaN',
          'no maximum limit — user can request limit=99999 and get all records',
        ],
        shouldNotFlag: [
          'skip/limit pagination pattern is correct approach for MongoDB',
          'returning page and limit in response is good practice',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['bug', 'pagination', 'type-coercion'],
    createdBy: 'manual',
  },

  // PERFORMANCE CASES (3)
  {
    type: 'review',
    difficulty: 'hard',
    category: 'performance',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 986,
      prTitle: 'Add N+1 query in booking list',
      prDescription: 'Shows hotel details alongside each booking',
      diff: `
+const bookings = await Booking.find({ userId: req.user.id });
+const result = await Promise.all(
+  bookings.map(async (booking) => {
+    const hotel = await Hotel.findById(booking.hotelId);
+    return { ...booking.toObject(), hotel };
+  })
+);
      `,
      groundTruth: {
        shouldCatch: [
          'N+1 query problem — one DB query per booking to fetch hotel',
          '10 bookings = 11 DB queries (1 for bookings + 10 for hotels)',
          'should use populate() or aggregate with $lookup to fetch in one query',
          'performance degrades linearly with number of bookings',
        ],
        shouldNotFlag: [
          'Promise.all is correctly used for parallel execution',
          'toObject() usage is correct for spreading Mongoose docs',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['performance', 'database', 'n+1'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'performance',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 985,
      prTitle: 'Add index to frequently queried field',
      prDescription: 'Adds compound index for better query performance',
      diff: `
+hotelSchema.index({ location: 1, pricePerNight: 1, rating: -1 });
+hotelSchema.index({ name: 'text' });
      `,
      groundTruth: {
        shouldCatch: [],
        shouldNotFlag: [
          'compound index on location + price + rating is correct for common filter queries',
          'text index on name enables efficient text search',
          'descending rating index for sort performance is correct',
          'index definition location in schema is correct',
        ],
        expectedVerdict: 'APPROVE',
      },
    },
    tags: ['performance', 'database', 'index'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'easy',
    category: 'style',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 984,
      prTitle: 'Add console.log statements for debugging',
      prDescription: 'Added logging to track booking flow',
      diff: `
+console.log('booking request received', req.body);
+console.log('user id', req.user.id);
+const booking = await Booking.create(req.body);
+console.log('booking created', booking);
      `,
      groundTruth: {
        shouldCatch: [
          'console.log(req.body) may expose sensitive user data in production logs',
          'console.log(req.user.id) leaks user identity in logs',
          'debug logs should be removed before merging to main',
          'use a proper logger with log levels instead of console.log',
        ],
        shouldNotFlag: [
          'Booking.create pattern is correct',
          'async/await usage is correct',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['style', 'logging', 'security'],
    createdBy: 'manual',
  },

  // EDGE CASES (4)
  {
    type: 'review',
    difficulty: 'easy',
    category: 'edge-case',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 983,
      prTitle: 'Add empty array check',
      prDescription: 'Handles edge case when no hotels found',
      diff: `
-const hotels = await Hotel.find(filter);
-res.json({ hotels });
+const hotels = await Hotel.find(filter);
+if (!hotels || hotels.length === 0) {
+  return res.status(404).json({ message: 'No hotels found' });
+}
+res.json({ hotels, count: hotels.length });
      `,
      groundTruth: {
        shouldCatch: [],
        shouldNotFlag: [
          'empty array check is correct defensive programming',
          'returning count with results is good API practice',
          '404 for no results is acceptable though 200 with empty array is also valid',
          'early return pattern is correct',
        ],
        expectedVerdict: 'APPROVE',
      },
    },
    tags: ['edge-case', 'defensive-programming'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'hard',
    category: 'edge-case',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 982,
      prTitle: 'Add concurrent booking with no transaction',
      prDescription: 'Updates available rooms when booking is made',
      diff: `
+const hotel = await Hotel.findById(hotelId);
+if (hotel.availableRooms < 1) {
+  return res.status(400).json({ message: 'No rooms available' });
+}
+hotel.availableRooms -= 1;
+await hotel.save();
+const booking = await Booking.create({ hotelId, userId, ...details });
      `,
      groundTruth: {
        shouldCatch: [
          'race condition — two concurrent requests can both read availableRooms: 1, both pass the check, both decrement, resulting in availableRooms: -1',
          'check-then-act is not atomic — needs MongoDB transaction or findOneAndUpdate with $inc and condition',
          'should use findOneAndUpdate with { availableRooms: { $gt: 0 } } filter atomically',
          'booking created after room decrement — if booking creation fails, room count is wrong',
        ],
        shouldNotFlag: [
          'async/await pattern is correct',
          'checking availability before booking is the right approach conceptually',
        ],
        expectedVerdict: 'REQUEST_CHANGES',
      },
    },
    tags: ['edge-case', 'concurrency', 'race-condition', 'critical'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'medium',
    category: 'style',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 981,
      prTitle: 'Refactor duplicate error handling',
      prDescription: 'Extracts common error handler to middleware',
      diff: `
-  } catch (err) {
-    res.status(500).json({ error: err.message });
-  }
+  } catch (err) {
+    next(err);
+  }
+
+// app.js
+app.use((err, req, res, next) => {
+  const status = err.status || 500;
+  res.status(status).json({ 
+    message: err.message || 'Internal server error',
+    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
+  });
+});
      `,
      groundTruth: {
        shouldCatch: [],
        shouldNotFlag: [
          'centralized error handler is best practice in Express',
          'using next(err) correctly delegates to error middleware',
          'conditional stack trace only in development is correct security practice',
          'default status 500 for unhandled errors is correct',
        ],
        expectedVerdict: 'APPROVE',
      },
    },
    tags: ['style', 'refactor', 'error-handling'],
    createdBy: 'manual',
  },
  {
    type: 'review',
    difficulty: 'hard',
    category: 'multi-file',
    review: {
      repoFullName: SAFER_SETU_FULL_NAME,
      prNumber: 980,
      prTitle: 'Add rate limiting to auth routes',
      prDescription: 'Prevents brute force attacks on login',
      diff: `
+const rateLimit = require('express-rate-limit');
+const loginLimiter = rateLimit({
+  windowMs: 15 * 60 * 1000,
+  max: 5,
+  message: 'Too many login attempts'
+});
+router.post('/login', loginLimiter, loginController);
      `,
      groundTruth: {
        shouldCatch: [],
        shouldNotFlag: [
          '15 minute window with 5 attempts is reasonable for login rate limiting',
          'applying limiter only to login route is correct — not all routes',
          'clear error message for rate limit is good UX',
          'express-rate-limit is the standard library for this use case',
        ],
        expectedVerdict: 'APPROVE',
      },
    },
    tags: ['security', 'rate-limiting', 'brute-force'],
    createdBy: 'manual',
  },
];

/* const seedEvals = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  await EvalCase.deleteMany({});
  console.log('Cleared existing eval cases');

  const allCases = [...retrievalEvals, ...reviewEvals];
  await EvalCase.insertMany(allCases);

  const retrievalCount = retrievalEvals.length;
  const reviewCount = reviewEvals.length;

  console.log(`\n✅ Eval dataset seeded successfully`);
  console.log(`Retrieval cases: ${retrievalCount}`);
  console.log(`Review cases:    ${reviewCount}`);
  console.log(`Total:           ${retrievalCount + reviewCount}`);

  // Show difficulty breakdown
  const easy = allCases.filter(c => c.difficulty === 'easy').length;
  const medium = allCases.filter(c => c.difficulty === 'medium').length;
  const hard = allCases.filter(c => c.difficulty === 'hard').length;
  console.log(`\nDifficulty: Easy=${easy} Medium=${medium} Hard=${hard}`);

  // Show category breakdown
  const categories = {};
  allCases.forEach(c => {
    categories[c.category] = (categories[c.category] || 0) + 1;
  });
  console.log('\nCategories:');
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat.padEnd(20)} ${count}`);
  });

  await mongoose.disconnect();
}; */


// CHANGED (Fix 3) — upsert by natural key instead of deleteMany + insertMany,
// so results[] history survives every time you reseed.
const seedEvals = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const allCases = [...retrievalEvals, ...reviewEvals];

  let inserted = 0;
  let skipped = 0;

  for (const evalCase of allCases) {
    // Natural key: prNumber for review cases, query text for retrieval cases.
    // Both are stable and unique across your fixture set.
    const filter = evalCase.type === 'review'
      ? { type: 'review', 'review.prNumber': evalCase.review.prNumber }
      : { type: 'retrieval', 'retrieval.query': evalCase.retrieval.query };

    const result = await EvalCase.findOneAndUpdate(
      filter,
      { $setOnInsert: evalCase }, // only writes if the doc doesn't exist yet — never touches results[] on an existing doc
      { upsert: true, rawResult: true }
    );

    if (result.lastErrorObject?.upserted) inserted++;
    else skipped++;
  }

  console.log(`\n✅ Eval dataset seeded`);
  console.log(`New cases inserted:              ${inserted}`);
  console.log(`Existing cases skipped (history preserved): ${skipped}`);

  const retrievalCount = retrievalEvals.length;
  const reviewCount = reviewEvals.length;

  console.log(`Retrieval cases: ${retrievalCount}`);
  console.log(`Review cases:    ${reviewCount}`);
  console.log(`Total:           ${retrievalCount + reviewCount}`);

  // Show difficulty breakdown
  const easy = allCases.filter(c => c.difficulty === 'easy').length;
  const medium = allCases.filter(c => c.difficulty === 'medium').length;
  const hard = allCases.filter(c => c.difficulty === 'hard').length;
  console.log(`\nDifficulty: Easy=${easy} Medium=${medium} Hard=${hard}`);

  // Show category breakdown
  const categories = {};
  allCases.forEach(c => {
    categories[c.category] = (categories[c.category] || 0) + 1;
  });
  console.log('\nCategories:');
  Object.entries(categories).forEach(([cat, count]) => {
    console.log(`  ${cat.padEnd(20)} ${count}`);
  });

  await mongoose.disconnect();
};
seedEvals().catch(console.error);