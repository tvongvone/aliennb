const express = require('express')
const {setTokenCookie, requireAuth} = require('../../utils/auth')
const {User} = require('../../db/models')

const router = express.Router();
const {check} = require('express-validator');
const {handleValidationErrors} = require('../../utils/validation')

const validateSignup = [
    check('email')
    .exists({checkFalsy: true})
    .isEmail()
    .withMessage('Please provide a valid email'),
    check('username')
    .exists({checkFalsy: true})
    .isLength({min: 4})
    .withMessage('Please provide a username with at least 4 characters'),
    check('username')
    .not()
    .isEmail()
    .withMessage('Username cannot be an email.'),
    check('password')
    .exists({checkFalsy:true})
    .isLength({min: 6})
    .withMessage('Password must be 6 characters or more.'),
    handleValidationErrors
]

router.post('/', validateSignup, async(req, res, next) => {
    const {firstName, lastName, email, password, username} = req.body

    const emailExists = await User.findOne({where: {email: email}})
    const usernameExists = await User.findOne({where: {username: username}})

    if (emailExists) {
        const err = new Error('User already exists')
        err.status = 403;
        err.errors = ['User with that email already exists']
        return next(err);

    } else if (usernameExists) {
        const err = new Error('User already exists')
        err.status = 403
        err.errors = ['User with that username already exists']
        return next(err)
    } else {
        const user = await User.signup({ firstName, lastName, email, username, password })

        const token = await setTokenCookie(res, user);

        user.setDataValue('token', token)

        return res.json({
            user:user
        })
    }

})


module.exports = router
