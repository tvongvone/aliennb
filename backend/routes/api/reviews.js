const express = require('express');

const {requireAuth} = require('../../utils/auth')
const {Review, Image, Spot,User} = require('../../db/models');


const router = express.Router();

router.put('/:id', requireAuth, async (req, res, next) => {
    const {review, stars} = req.body

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
        const reviewExists = await Review.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        })

        if(reviewExists) {
            reviewExists.update({
                review, stars
            })

            res.json(reviewExists)
        } else {
            const err =  new Error("Couldn't find a Review with the specified id")
            err.status= 404
            err.errors = ["Review couldn't be found"]
            next(err)
        }
    }
})

router.post('/:id/images', requireAuth, async (req, res, next) => {
    const theReview = await Review.findOne({
        where: {
            id: req.params.id,
            userId: req.user.id
        },
        include: [
            {
                model: Image,
                as: "ReviewImages"
            }
        ]
    })

    if(!theReview) {
        const review = await Review.findByPk(req.params.id)

        if(review) {
            const err = new Error("Review must belong to user")
            err.title = 'Authorization error'
            err.status = 404;
            next(err)
        } else{
            const err = new Error("Review couldn't be found")
            err.status = 404
            next(err)
        }
    } else {

    if(theReview.toJSON().ReviewImages.length >= 10) {
        const err = new Error("10 images max per resource")
        err.status = 403
        err.errors=["Maximum number of images for this resource was reached"]
        next(err)
    } else{
        const reviewImage = await Image.create({
            reviewId: req.params.id,
            url: req.body.url
        })

        const displayImage = await Image.findOne({
            where: {
                id: reviewImage.dataValues.id
            },
            attributes: ['id', 'url']
        })

        res.json(displayImage)
    }
}
})

router.get('/current', requireAuth, async (req, res, next) => {
    const review = await Review.findAll({
        where: {
            userId: req.user.id
        },
        include: [
            {
                model: User,
                attributes: ['id', 'firstName', 'lastName']
            },
            {
                model: Spot,
                attributes: {exclude: ['createdAt', 'updatedAt']},
                include: {
                    model: Image,
                    as: "SpotImages"
                }
            },
            {
                model: Image,
                as: 'ReviewImages',
                attributes: ['id', 'url']
            }
        ]
    })
    let result = {}
    let reviewList = []
    review.forEach(ele => reviewList.push(ele.toJSON()))
    reviewList.forEach(ele => {
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
    result.Reviews = reviewList

    res.json(result)
})

router.delete('/:id', requireAuth, async(req, res, next) => {
    const nonOwner = await Review.findByPk(req.params.id)
    const deleteItem = await Review.findOne({
        where: {
            id: req.params.id,
            userId: req.user.id
        }
    })

    if(!nonOwner) {
        const err = new Error("Couldn't find a Review with the specified id")
        err.status = 404
        err.errors = ["Review couldn't be found"]
        next(err)
    }

    if(deleteItem) {

        await deleteItem.destroy()

        res.json({
            message: "Successfully deleted",
            statusCode: 200
        })
    } else {
        const err = new Error("Spot does not belong to current user")
        err.title = "Authorization Error"
        err.status = 404
        next(err)
    }

})



module.exports = router;
