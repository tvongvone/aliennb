const router = require('express').Router();
const sessionRouter = require('./session.js')
const usersRouter = require('./users.js')
const spotsRouter = require('./spots')
const bookingsRouter = require('./bookings')
const reviewsRouter = require('./reviews')
const spotImageRouter = require('./spot-images')
const reviewImageRouter = require('./review-images')

const {restoreUser} = require('../../utils/auth.js')

router.use(restoreUser);

router.use('/session',sessionRouter)

router.use('/users', usersRouter)

router.use('/spots', spotsRouter)

router.use('/bookings', bookingsRouter)

router.use('/reviews', reviewsRouter)

router.use('/review-images', reviewImageRouter)

router.use('/spot-images', spotImageRouter)

router.post('/test', (req, res) => {
    res.json({ requestBody: req.body })
})

module.exports = router
