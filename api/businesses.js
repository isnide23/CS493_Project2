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

async function createBusinessesTable() {
  await mysqlPool.query(`
    CREATE TABLE businesses(
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      ownerid MEDIUMINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255) NOT NULL,
      city VARCHAR(255) NOT NULL,
      state CHAR(2) NOT NULL,
      zip CHAR(5) NOT NULL,
      phone VARCHAR(15) NOT NULL,
      category VARCHAR(255) NOT NULL,
      subcategory VARCHAR(255) NOT NULL,
      website VARCHAR(255) NOT NULL,
      PRIMARY KEY (id),
      INDEX idx_ownerid (ownerid)
    )`
  )
}


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

  return {
    businesses: results,
    page: page,
    totalPages: lastPage,
    pageSize: pageSize,
    count: count
  }
};

async function getBusinessById(businessId) {
  const [ results ] = await mysqlPool.query(
    'SELECT * FROM businesses WHERE id = ?',
    [ businessId ],
);
return results[0];
}

async function insertNewBusiness(business) {
  const validatedBusiness = extractValidFields(
    business,
    businessSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO businesses SET ?',
    validatedBusiness
  );
  return result.insertId
}

async function updateBusinessById(businessId, business) {
  const validatedBusiness = extractValidFields(
      business,
      businessSchema
  );
  const [ result ] = await mysqlPool.query(
      'UPDATE businesses SET ? WHERE id = ?',
      [ validatedBusiness, businessId ]
  );
  return result.affectedRows > 0;
}

async function deleteBusinessById(businessId) {
  const [ result ] = await mysqlPool.query(
      'DELETE FROM businesses WHERE id = ?',
      [ businessId ]
  );
  return result.affectedRows > 0;
}

// create a new business table
router.post('/createBusinessesTable', async (req, res) => {
  try {
    await createBusinessesTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating businesses table"
    })
  }
});

/*
 * Route to return a list of businesses.
 */
router.get('/', async function (req, res) {
  try {
    const businessesPage = await getBusinessesPage(parseInt(req.query.page) || 1);
    res.status(200).send(businessesPage);
  } catch (err) {
    res.status(500).json({
      error: "Error fetching businesses list. Try again later."
    });
  }

});

/*
 * Route to create a new business.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const id = await insertNewBusiness(req.body);
      res.status(201).send({ id: id });
    } catch (err) {
      console.log("err", err)
      res.status(500).json({
        error: "Error inserting business into DB"
      });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to fetch info about a specific business.
 */
router.get('/:businessid', async function (req, res, next) {
  try {
    const business = await getBusinessById(req.params.businessid);
    res.status(200).json(business);
  } catch {
    next();
  }
});

/*
 * Route to replace data for a business.
 */
router.put('/:businessid', async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema)) {
    try {
      const updateSucessful = await updateBusinessById(req.params.businessid, req.body)
      if (updateSucessful) {
        res.status(200).send({
          id: req.params.businessid,
          links: {
            business: `/businesses/${req.params.businessid}`
          }});
      } else {
        next();
      }
    } catch (err) {
      res.status(500).json({
        error: "Unable to update business"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', async function (req, res, next) {
  try {
    const deleteSuccessful = await deleteBusinessById(parseInt(req.params.businessid));
    if (deleteSuccessful) {
      res.status(204).end();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete lodging."
    });
  }
});
