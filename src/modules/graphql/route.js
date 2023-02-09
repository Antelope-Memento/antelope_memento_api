const express = require("express");
const constroller = require("./controller");

const router = express.Router();

router.use((req, res, next) => {
    console.log('req.body: ', JSON.stringify(req.body));
    next();
});

router.use("/graphql", constroller);

module.exports = router;
