const express = require('express');

const {requireAuth} = require('../../utils/auth')
const {User, Booking, Spot, Image, Review} = require('../../db/models');


const router = express.Router();

router.delete('/:id', requireAuth, async (req, res, next) => {
    const reviewImage = await Image.findByPk(req.params.id)

    if(!reviewImage) {
        res.statusCode = 404
        return res.json({
            message: "Review image couldn't be found",
            statusCode: 404
        })
    }

    const review = await Review.findOne({
        where: {
            id: reviewImage.dataValues.reviewId,
            userId: req.user.id
        }
    })

    if(!review) {
        res.statusCode = 404
        return res.json({
            message: "Review must belong to current user",
            statusCode: 404
        })
    } else {
        await reviewImage.destroy()

        res.statusCode = 200
        return res.json({
            message: "Successfully deleted",
            statusCode: 200
        })
    }

})


module.exports = router;
