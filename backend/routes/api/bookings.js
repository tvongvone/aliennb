const express = require('express');

const {requireAuth} = require('../../utils/auth')
const {Booking, Spot, Sequelize, Image} = require('../../db/models');
const Op = Sequelize.Op

const router = express.Router();

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
    const exist = await Booking.findByPk(req.params.id)

    if(!exist) {
        res.statusCode = 404
        return res.json({
            message: "Booking couldn't be found",
            statusCode: 404
        })
    }

    const owner = await Booking.findOne({
        where: {
            id: req.params.id,
            userId: req.user.id
        }
    })

    if(!owner) {
        res.statusCode = 404
        return res.json({
            message: "Booking does not belong to you",
            statusCode: 404
        })
    }

    if(new Date(owner.dataValues.startDate).getTime() <= new Date().getTime() && new Date(owner.dataValues.endDate).getTime() >= new Date().getTime()) {
        res.statusCode = 403
        return res.json({
            message: "Bookings that have been started can't be deleted"
        })
    } else {
        await owner.destroy()
        res.statusCode = 200

        res.json({
            message: "Successfully deleted",
            statusCode: 200
        })
    }
})

router.put('/:id', requireAuth, dateMiddleware, async (req, res, next) => {
    let noErrors = true

    const bookingExist = await Booking.findByPk(req.params.id)

    if(!bookingExist) {
        noErrors = false
        res.status = 404
        res.json({
            message: "Booking couldn't be found",
            statusCode: 404
        })
    }


    const ownBooking = await Booking.findOne({
        where: {
            id: req.params.id,
            userId: req.user.id
        }
    })

     if(!ownBooking) {
        noErrors = false
        const err = "Booking must belong to User"
        err.status = 404
        next(err)
    }
        if(ownBooking.dataValues.endDate < new Date()) {
            noErrors = false
            res.status = 403
            return res.json({
                message: "Past booking can't be modified",
                statusCode: 403
            })
        }

        const allBookings = await Booking.findAll({
            where: {
                spotId: ownBooking.dataValues.spotId
            }
        })

        let bookingList = []
        allBookings.forEach(booking => {
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
            ownBooking.update({
                startDate: req.body.startDate,
                endDate: req.body.endDate
            })

            res.json(ownBooking)
        }

})

router.get('/current', requireAuth, async (req, res, next) => {
    const booking = await Booking.findAll({
    where: {
        userId: req.user.id,
        spotId: {
            [Op.not]: null
        }
    },
    include: [
        {
            model: Spot,
            include: [
                {
                    model: Image,
                    as: 'SpotImages',
                    attributes: ['url', 'preview']
                }
            ],
            attributes: {exclude: ['createdAt', 'updatedAt']}
        }
    ],
    })
    let bookingList = []
    booking.forEach(book => {
        bookingList.push(book.toJSON())
    })

    bookingList.forEach(ele => {
        ele.Spot.SpotImages.forEach(image => {
            if(image.preview === true) {
                ele.Spot.previewImage = image.url
            }
        })
        if(!ele.Spot.previewImage) {
            ele.Spot.previewImage = 'N/A'
        }
        delete ele.Spot.SpotImages
    })
    let result = {}
    result.Bookings = bookingList
    res.json(result)
})

module.exports = router;
