const express = require('express');

const {requireAuth} = require('../../utils/auth')
const {Spot, Image} = require('../../db/models');


const router = express.Router();

router.delete('/:id', requireAuth, async (req, res, next) => {
    const spotImage = await Image.findByPk(req.params.id)

    if(!spotImage) {
        res.statusCode = 404
        return res.json({
            message: "Spot image couldn't be found",
            statusCode: 404
        })
    }

    const spot = await Spot.findOne({
        where: {
            id: spotImage.dataValues.spotId,
            ownerId: req.user.id
        }
    })

    if(!spot) {
        res.statusCode = 404
        return res.json({
            message: "Spot must belong to current User",
            statusCode: 404
        })
    } else {
        await spotImage.destroy()
        res.statusCode = 200
        res.json({
            message: "Successfully deleted",
            statusCode: 200
        })
    }
})

module.exports = router
