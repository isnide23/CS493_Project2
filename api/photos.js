const router = require('express').Router();
const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const mysqlPool = require('../lib/mysqlPool');

const photos = require('../data/photos');
const { businesses } = require('./businesses');

exports.router = router;
exports.photos = photos;

/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};


async function createPhotosTable() {
  await mysqlPool.query(
    `CREATE TABLE photos(
      userid MEDIUMINT NOT NULL, 
      businessid MEDIUMINT NOT NULL,
      caption VARCHAR(255),
      id MEDIUMINT NOT NULL AUTO_INCREMENT,
      PRIMARY KEY (id),
      INDEX idx_userid (userid),
      INDEX idx_businessid (businessid)
    )`
  )
}

async function insertNewPhoto(photo) {
  const validatedPhoto = extractValidFields(
    photo,
    photoSchema
  )
  const [ result ] = await mysqlPool.query(
    'INSERT INTO photos SET ?', 
    validatedPhoto
  );
  return result.insertId
}

async function getPhotoById(photoId) {
  const [ results ] = await mysqlPool.query(
    'SELECT * FROM photos WHERE id = ?',
    [ photoId ],
  );
  return results[0];
}

async function updatePhotoById(photoId, photo) {
  const validatedPhoto = extractValidFields(
    photo,
    photoSchema
  )
  const [ result ] = await mysqlPool.query(
    'UPDATE photos SET ? WHERE id = ?',
    [ validatedPhoto, photoId ]
  )
  return result.affectedRows > 0;
}

async function deletePhotoById(photoId) {
  const [ result ] = await mysqlPool.query(
    'DELETE FROM photos WHERE id = ?',
    [ photoId ]
  )
  return result.affectedRows > 0;
}

router.post('/createPhotosTable', async (req, res) => {
  try {
    await createPhotosTable();
    res.status(200).send({})
  } catch (err) {
    res.status(500).json({
      error: "Error creating photos table"
    })
  }
});


/*
 * Route to create a new photo.
 */
router.post('/', async function (req, res, next) {
  if (validateAgainstSchema(req.body, photoSchema)) {
    try {
      const id = await insertNewPhoto(req.body);
      res.status(201).send({ id: id });
    } catch (err) {
      res.status(500).json({
        error: "Error inserting photo into database"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid photo object"
    });
  }
});

/*
 * Route to fetch info about a specific photo.
 */
router.get('/:photoid', async function (req, res, next) {
  try {
    const photo = await getPhotoById(req.params.photoid);
    res.status(200).json(photo);
  } catch {
    next();
  }
});

/*
 * Route to update a photo.
 */
router.put('/:photoid', async function (req, res, next) {
  if (validateAgainstSchema(req.body, photoSchema)) {
    try {
      const updateSucessful = await updatePhotoById(req.params.photoid, req.body)
      if (updateSucessful) {
        res.status(200).send({
          id: req.params.photoid,
          links: {
            business: `/businesses/${req.params.photoid}`
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
 * Route to delete a photo.
 */
router.delete('/:photoid', async function (req, res, next) {
  try {
    const deleteSuccessful = await deletePhotoById(req.params.photoid)
    if (deleteSuccessful) {
      res.status(204).end();
    } else {
      next();
    }
  } catch (err) {
    res.status(500).send({
      error: "Unable to delete photo"
    })
  }
});