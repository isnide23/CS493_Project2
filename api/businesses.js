const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');

const businesses = require('../data/businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

exports.router = router;
exports.businesses = businesses;

/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};


async function getBusinessesCount() {
  const [ results ] = await mysqlPool.query(
    "SELECT COUNT(*) AS count FROM businesses"
  );
  return results[0].count;
}

async function getBusinessesPage(page) {
  const count = await getBusinessesCount();

  const pageSize = 10;
  const lastPage = Math.ceil(count / pageSize);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;
  const offset = (page - 1) * pageSize;

  const [ results ] = await mysqlPool.query(
    'SELECT * FROM businesses ORDER BY id LIMIT ?,?',
    [offset, pageSize]
  );


}

/*
 * Route to return a list of businesses.
 */
router.get('/', async function (req, res) {
  try {
    res.status(200).send(lodgingsPage);
  } catch (err) {
    res.status(500).json({
      error: "Error fetching lodgings list. Try again later."
    });
  }

});

/*
 * Route to create a new business.
 */
router.post('/', function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    const business = extractValidFields(req.body, businessSchema);
    business.id = businesses.length;
    businesses.push(business);
    res.status(201).json({
      id: business.id,
      links: {
        business: `/businesses/${business.id}`
      }
    });
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {
    /*
     * Find all reviews and photos for the specified business and create a
     * new object containing all of the business data, including reviews and
     * photos.
     */
    const business = {
      reviews: reviews.filter(review => review && review.businessid === businessid),
      photos: photos.filter(photo => photo && photo.businessid === businessid)
    };
    Object.assign(business, businesses[businessid]);
    res.status(200).json(business);
  } else {
    next();
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {

    if (validateAgainstSchema(req.body, businessSchema)) {
      businesses[businessid] = extractValidFields(req.body, businessSchema);
      businesses[businessid].id = businessid;
      res.status(200).json({
        links: {
          business: `/businesses/${businessid}`
        }
      });
    } else {
      res.status(400).json({
        error: "Request body is not a valid business object"
      });
    }

  } else {
    next();
  }
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', function (req, res, next) {
  const businessid = parseInt(req.params.businessid);
  if (businesses[businessid]) {
    businesses[businessid] = null;
    res.status(204).end();
  } else {
    next();
  }
});
