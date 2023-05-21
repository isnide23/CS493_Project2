const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');

const reviews = require('../data/reviews');
const { businesses } = require('./businesses');

exports.router = router;
exports.reviews = reviews;

/*
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};

async function createBusinessesTable() {
  await mysqlPool.query(`
    CREATE TABLE businesses(
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      userid MEDIUMINT NOT NULL,
      businessid MEDIUMINT NOT NULL,
      dollars MEDIUMINT NOT NULL,
      stars MEDIUMINT NOT NULL,
      review VARCHAR(255),
      PRIMARY KEY (id),
      INDEX idx_businessid (businessid)
    )`
  )
}

async function getReviewById(reviewId) {
  const [ results ] = await mysqlPool.query(
    'SELECT * FROM reviews WHERE id = ?',
    [ reviewId ],
  );
  return results[0];
}

async function checkUserPreviousReview(review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    `SELECT COUNT(*) AS count FROM reviews WHERE userid = ? AND businessid = ?`,
    [ validatedReview.userid, validatedReview.businessid ]
  );
  return result[0].count
}

async function insertNewReview(review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO reviews SET ?',
    validatedReview
  );
  return result.insertId
}

async function updateReviewById(reviewId, review) {
  const validatedReview = extractValidFields(
    review,
    reviewSchema
  )
  const [ result ] = await mysqlPool.query(
    'UPDATE reviews SET ? WHERE id = ?',
    [ validatedReview, reviewId ]
  )
  return result.affectedRows > 0;
}

async function deleteReviewById(id) {
  const [ result ] = await mysqlPool.query(
    'DELETE FROM reviews WHERE id = ?',
    [ id ]
  )
  return result.affectedRows > 0;
}

router.post('/createReviewsTable', async (req, res) => {
  try {
    await createReviewsTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating reviews table"
    })
  }
});


/*
 * Route to create a new review.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {

    const review = extractValidFields(req.body, reviewSchema);
    try {
      const userReviewedThisBusinessAlready = await checkUserPreviousReview(req.body)
      if (userReviewedThisBusinessAlready > 0) {
        res.status(403).json({
          error: "User has already posted a review of this business"
        });
      } else {
        try {
          const id = await insertNewReview(review);
          res.status(201).send({ id: id });
        } catch (err) {
          res.status(500).json({
            error: "Error inserting review into database"
          });
        }
      }
    } catch (err) {
        res.status(500).json({
          error: "Error validating user review history"
        });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }
});

/*
 * Route to fetch info about a specific review.
 */
router.get('/:reviewid', async function (req, res, next) {
  try {
    const review = await getReviewById(req.params.reviewid);
    res.status(200).json(review);
  } catch {
    next();
  }
});

/*
 * Route to update a review.
 */
router.put('/:reviewid', async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {
    try {
      const updateSucessful = await updateBusinessById(req.params.reviewid, req.body)
      if (updateSucessful) {
        res.status(200).send({
          id: req.params.reviewid,
          links: {
            review: `/reviews/${req.params.reviewid}`
          }});
      } else {
        next();
      }
    } catch (err) {
      res.status(500).json({
        error: "Unable to update review"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }
});

/*
 * Route to delete a review.
 */
router.delete('/:reviewID', async function (req, res, next) {
  try {
    const deleteSuccessful = await deleteReviewById(req.params.reviewID)
    if (deleteSuccessful) {
      res.status(204).end();
    } else { 
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete review"
    })
  }
});