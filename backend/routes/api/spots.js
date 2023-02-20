const express = require("express")
const {requireAuth} = require('../../utils/auth')
const {Spot, Image, User, Review, Booking, Sequelize, sequelize} = require('../../db/models')

const router = express.Router();
const {check} = require('express-validator');
const {handleValidationErrors} = require('../../utils/validation');

const Op = Sequelize.Op

const validateSpot = [
    check('address')
    .exists({checkFalsy: true})
    .notEmpty()
    .withMessage('Street address is required'),
    check('city')
    .exists({checkFalsy: true})
    .withMessage('City is required'),
    check('state')
    .exists({checkFalsy:true})
    .withMessage('State is required'),
    check('country')
    .exists({checkFalsy:true})
    .withMessage('Country is required'),
    check('lat')
    .not()
    .isString()
    .withMessage('Latitude is not valid'),
    check('lng')
    .not()
    .isString()
    .withMessage('Longitude is not valid'),
    check('name')
    .exists({checkFalsy:true})
    .isLength({max: 50})
    .withMessage('Name must be less than 50 characters'),
    check('description')
    .exists({checkFalsy:true})
    .isLength({min: 30})
    .withMessage('Description is required'),
    check('price')
    .exists({checkFalsy:true})
    .withMessage('Price is required'),
    handleValidationErrors
]

const dateMiddleware = (req, res, next) => {
    const {startDate, endDate} = req.body
    if(new Date(startDate).getTime() < new Date().getTime()) {
        const err = new Error("Booking must be in the future")
        err.title = 'Validation Error'
        err.status = 403
        next(err)
    }

    if(new Date(endDate).getTime() <= new Date(startDate).getTime()) {
        const err = new Error("endDate cannot be on or before startDate")
        err.title = 'Validation Error'
        err.status = 400
        next(err)
    }

    next()
}

router.delete('/:id', requireAuth, async (req, res, next) => {
    const deleteSpot = await Spot.findByPk(req.params.id)

    if(!deleteSpot) {
        const err = new Error("Couldn't find a Spot with the specified id")
        err.title = "Validation Error"
        err.status = 404
        err.errors = ["Spot couldn't be found"]
        next(err)
    }
    const owner = await Spot.findOne({where: {id: req.params.id, ownerId: req.user.id}})

    if(!owner) {
        const err = new Error("This is not your spot")
        err.title = "Authorization Error"
        err.status = 404
        next(err)
    } else {
        await deleteSpot.destroy()
        res.status = 200;
        res.json({
            message: "Successfully deleted",
            statusCode: 200
        })

    }
})

router.put('/:id', validateSpot, requireAuth, async(req, res, next) => {
    const {address, city, state, country,lat, lng, name, description, price} = req.body

    const spot = await Spot.findOne({
        where: {
            id:req.params.id,
            ownerId: req.user.id
        }
    })

    if(spot) {
        spot.update({
            address, city, state, country,lat, lng, name, description, price
        })

        res.json(spot)
    } else {
        const nonOwner = await Spot.findByPk(req.params.id)
        if(nonOwner) {
            const err = new Error("Spot does not belong to you")
            err.title = 'Authorization Error'
            err.status = 404
            next(err)
        }   else {
        const err = new Error("Spot couldn't be found")
        err.status = 404
        next(err)
        }
    }
})

router.post('/:id/reviews', requireAuth, async (req, res, next) => {
    const {review, stars} = req.body

    const existingReview = await Review.findOne({
        where: {
            userId: req.user.id,
            spotId: parseInt(req.params.id)
        }
    })

    const spotExist = await Spot.findByPk(req.params.id)

    if(!spotExist) {
        const err = new Error('Validation error')
        err.status = 403,
        err.errors = ["Spot couldn't be found"]
        next(err)
    }

    if(existingReview) {
        const err = new Error('Validation error')
        err.status = 403,
        err.errors = ["User already has a review for this spot"]
        next(err)
    }

    if(!review) {
        const err = new Error('Validation error')
        err.status = 400,
        err.errors = ['Review text is required']
        next(err)
    } else if (stars !== parseInt(stars) || stars < 1 || stars > 5) {
        const err = new Error('Validation error')
        err.status = 400,
        err.errors = ['Stars must be an integer from 1 to 5']
        next(err)
    } else {
        const theReview = await Review.create({
            userId: req.user.id,
            spotId: parseInt(req.params.id),
            review: review,
            stars: stars
        })


        const finalReview = await Review.findByPk(theReview.id, {
            include: [
                {
                    model:User
                }
            ]
        })

        res.json(finalReview)
    }
})

router.post('/:id/bookings', dateMiddleware, requireAuth, async (req, res, next) => {
    const owner = await Spot.findOne({
        where: {
            id: req.params.id,
            ownerId: req.user.id
        }
    })

    let noErrors = true;

    if(owner) {
        noErrors = false
        res.statusCode = 404
        return res.json({
            message: "Spot must not belong to current user",
            statusCode: 404
        })
    }

    const spotExist = await Spot.findByPk(req.params.id)

    if(!spotExist) {
        noErrors = false
        const err = new Error("Could not find Spot by specified Id")
        err.title = "Server Error"
        err.status = 404
        next(err)
    }

    const existingBooking = await Booking.findAll({
        where: {
            spotId: req.params.id,
        }
    })

    let bookingList = []
    existingBooking.forEach(booking => {
        bookingList.push(booking.toJSON())
    })

    bookingList.forEach(booking => {
        if(new Date(req.body.startDate).getTime() >= new Date(booking.startDate).getTime() &&
        new Date(req.body.startDate).getTime() <= new Date(booking.endDate).getTime()) {
            noErrors = false
            const err = new Error("Sorry, this spot is already booked for the specified dates")
            err.status = 403
            err.errors = ['Start date conflicts with an existing booking',
        'End date conflicts with an existing booking']
            next(err)
        }
        if(new Date(req.body.endDate).getTime() >= new Date(booking.startDate).getTime() &&
        new Date(req.body.endDate).getTime() <= new Date(booking.endDate).getTime()) {
            noErrors = false
            const err = new Error("Sorry, this spot is already booked for the specified dates")
            err.status = 403
            err.errors = ['Start date conflicts with an existing booking',
            'End date conflicts with an existing booking']
            next(err)
        }
    })

    if(noErrors) {
        const booking = await Booking.create({
            spotId: parseInt(req.params.id),
            userId: req.user.id,
            startDate: req.body.startDate,
            endDate: req.body.endDate
        })

        res.json(booking)
    }
})

router.post('/:id/images', requireAuth, async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.id)
    if(!spot) {
        res.status = 404
        res.json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }

    if(spot.ownerId === req.user.id) {
        const {url, preview} = req.body

        const image = await Image.create({
            userId: req.user.id,
            spotId: req.params.id,
            url,
            preview
        })


        res.status = 200
        res.json(image)

    } else {
        const err = new Error("Spot couldn't be found")
        err.status = 404
        err.errors = ['Spot does not belong to current User']
        next(err)
    }

})

router.post('/', validateSpot, requireAuth, async (req, res, next) => {
    const currentUser = req.user.id

    const {address, city, state, country, lat, lng, name, description, price} = req.body

    const userSpot = await Spot.create({
        ownerId: currentUser,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        description,
        price
    })
    if(userSpot) {
        res.status = 201
        res.json(userSpot)
    } else {
        res.status = 400
        next(err)
    }
})

router.get('/current', requireAuth, async (req, res) => {
    const spots = await Spot.findAll({
        where: {
            ownerId: req.user.id // req.user comes from requireAuth
        },
        include: [
            {
                model: Review
                //attributes: [[Sequelize.fn("AVG", Sequelize.col("stars")), "avgRating"]]
            },
            {
                model: Image,
                as: 'SpotImages'
            }
        ]
    })
    let spotsList = []
    spots.forEach(ele => {
        spotsList.push(ele.toJSON())
    })

    spotsList.forEach(spot => {
        let i = 0
        let sum = 0
        spot.Reviews.forEach(review => {
            i++
            sum = sum + review.stars
        })

        spot.avgRating = sum / i

        spot.SpotImages.forEach(image => {
            if(image.preview === true) {
                spot.previewImage = image.url
            }
        })
        if(!spot.previewImage) {
            spot.previewImage = 'N/A'
        }
        delete spot.Reviews
        delete spot.SpotImages
    })
    let result = {}
    result.Spots = spotsList

    return res.json(result)
})

router.get('/:id/bookings', requireAuth, async(req, res, next) => {

    const spotExists = await Spot.findByPk(req.params.id)


    if(!spotExists) {
        res.statusCode = 404
        return res.json({message: "Spot couldn't be found", statusCode: 404})
    }


    const owner = await Spot.findOne({
        where: {
            id: req.params.id,
            ownerId: req.user.id,
        }
    })

    if(owner) {
        const ownerBookings = await Booking.findAll({
            where: {
                spotId: req.params.id
            },
            include: [
                {
                    model: User,
                    attributes: ['id', 'firstName', 'lastName']
                }
            ],
            attributes: {}
        })

        if(ownerBookings.length < 1) {
            return res.json({
                message: "This spot currently has no bookings!"
            })
        }   else {
                let result = {}
                result.Bookings = ownerBookings
                return res.json(result)
        }

    }


        const bookings = await Booking.findAll({
            where: {
                spotId: req.params.id
            },
            attributes: ["spotId", "startDate", "endDate"]
        })
        if(bookings.length < 1) {
            return res.json({
                message: "This spot currently has no bookings!"
            })
        } else {
        let result = {}
        result.Bookings = bookings
        res.json(result)
    }
})

router.get('/:id/reviews', async (req, res, next) => {
    const spot = await Spot.findByPk(req.params.id)



    if(!spot) {
        const err = new Error("Couldn't find a Spot with the specified id")
        err.status = 404
        err.errors = ["Spot couldn't be found"]
        next(err)
    } else {
        const reviews = await Review.findAll({
            where: {
                spotId: req.params.id
            },
            include: [
                {
                    model: User
                },
                {
                    model: Image,
                    as: 'ReviewImages',
                    attributes: ['id', 'url']
                }
            ]
        })

        res.json(reviews)
    }
})



router.get('/', async(req, res, next) => {

    let {page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice} = req.query

    let result = {}

    const optionalParams = {where: {}}

    const err = new Error("Validation Error")

   if(parseInt(page) < 0 || parseInt(page) > 10) {
    err.status = 400
    err.errors = ['Page must be greater than or equal to 0']
    next(err)
   }

   if(parseInt(size) < 0 || parseInt(size) > 10) {
    err.status = 400
    err.errors = ['Size must be greater than or equal to 0']
    next(err)
   }

   if(!page) page = 0
   if(!size) size = 20

   page = parseInt(page)
   size = parseInt(size)

   let pagination = {}

   if (page >= 1 && size >= 1) {
    pagination.limit = size,
    pagination.offset = size * (page - 1)
}
    if(minLat && maxLat) {
        if(isNaN(parseFloat(minLat))) {
            err.status = 400
            err.errors = ['Minimum latitude is invalid']
            next(err)
        } else if (isNaN(parseFloat(maxLat))) {
            err.status = 400
            err.errors = ['Maximum latitude is invalid']
            next(err)
        } else {
            optionalParams.where.lat = {[Op.between]: [parseFloat(minLat), parseFloat(maxLat)]}
        }
    }

    else if(minLat) {
        if(isNaN(parseInt(minLat))) {
            err.status = 400
            err.errors = ['Minimum latitude is invalid']
            next(err)
        } else {
            optionalParams.where.lat = {[Op.gte]: parseFloat(minLat)}
        }
    }

    else if(maxLat) {
        if(isNaN(parseInt(maxLat))) {
            err.status = 400
            err.errors = ['Maximum latitude is invalid']
            next(err)
        } else {
            optionalParams.where.lat = {[Op.lte]: parseFloat(maxLat)}
        }
    }

    if(minLng && maxLng) {
        if(isNaN(parseFloat(minLng))) {
            err.status = 400
            err.errors = ['Minimum longitude is invalid']
            next(err)
        }
        else if (isNaN(parseFloat(maxLng))) {
            err.status = 400
            err.errors = ['Maximum longitude is invalid']
            next(err)
        } else {
            optionalParams.where.lng = {[Op.between]: [parseFloat(minLng), parseFloat(maxLng)]}
        }
    } else if (minLng) {
        if(isNaN(parseFloat(minLng))) {
            err.status = 400
            err.errors = ['Minimum longitude is invalid']
            next(err)
        } else {
            optionalParams.where.lng = {[Op.gte]: parseFloat(minLng)}
        }
    } else if (maxLng) {
        if(isNaN(parseFloat(maxLng))) {
            err.status = 400
            err.errors = ['Maximum longitude is invalid']
            next(err)
        } else {
            optionalParams.where.lng = {[Op.lte]: parseFloat(maxLng)}
        }
    }

    if(minPrice && maxPrice) {
        if(isNaN(parseFloat(minPrice)) || parseFloat(minPrice) < 0) {
            err.status = 400
            err.errors = ['Price must be greater than or equal to 0']
            next(err)
        } else if (isNaN(parseFloat(maxPrice)) || parseFloat(maxPrice) < 0) {
            err.status = 400
            err.errors = ['Price must be greater than or equal to 0']
            next(err)
        } else {
            optionalParams.where.price = {[Op.between]: [parseFloat(minPrice), parseFloat(maxPrice)]}
        }
    } else if (minPrice) {
        if(isNaN(parseFloat(minPrice)) || parseFloat(minPrice) < 0) {
            err.status = 400
            err.errors = ['Price must be greater than or equal to 0']
            next(err)
        } else {
            optionalParams.where.price = {[Op.gte]: parseFloat(minPrice)}
        }
    } else if (maxPrice) {
        if (isNaN(parseFloat(maxPrice)) || parseFloat(maxPrice) < 0) {
            err.status = 400
            err.errors = ['Price must be greater than or equal to 0']
            next(err)
        } else {
            optionalParams.where.price = {[Op.lte]: parseFloat(maxPrice)}
        }
    }

    const allSpots = await Spot.findAll({
        ...optionalParams,
        include: [
            {
                model: Review
            },
            {
                model: Image,
                as: 'SpotImages'
            }
        ],
        ...pagination
    })

    let spotsList = []
    allSpots.forEach(ele => {
        spotsList.push(ele.toJSON())
    })

    spotsList.forEach(spot => {
        let i = 0
        let sum = 0
        spot.Reviews.forEach(review => {
            i++
            sum = sum + review.stars
        })

        spot.avgRating = (sum / i).toFixed(1)

        spot.SpotImages.forEach(image => {
            if(image.preview === true) {
                spot.previewImage = image.url
            }
        })
        if(!spot.previewImage) {
            spot.previewImage = 'N/A'
        }
        delete spot.Reviews
        delete spot.SpotImages
    })
    result.Spots = spotsList
    result.page = page
    result.size = size
    res.status = 200

    return res.json(result)
})







router.get('/:id', async(req, res, next) => {
    let spot = await Spot.findOne({
        where: {
            id: req.params.id
        },
        include: [
            {
                model: Review
            },
            {
                model: Image,
                as: 'SpotImages',
            },
            {
                model: User,
                as: 'Owner'
            }
        ],
    })

    if(!spot) {
        const err =  new Error("Spot couldn't be found")
        err.status = 404
        err.errors = ["Spot couldn't be found with the specified Id"]
        next(err)
    } else {
        spot = spot.toJSON()


        res.status = 200
        res.json(spot)
    }
})

module.exports = router;
