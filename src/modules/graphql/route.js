const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.use('/graphql', (req, res, next) => {
    console.log('graphql req: ', JSON.stringify(req.body));
    next();
});

router.use('/graphql', controller);


module.exports = router;
