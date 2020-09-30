const bcrypt = require('bcryptjs');
const { UserInputError, AuthenticationError } = require('apollo-server');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const gravatar = require('gravatar');

const { User, Message } = require('../../models');

module.exports = {
  Query: {
    getUsers: async (_, __, { user }) => {
      try {
        if (!user) throw new AuthenticationError('Unauthenticated');

        let users = await User.findAll({
          attributes: ['username', 'imageUrl', 'createdAt'],
          where: { username: { [Op.ne]: user.username } }, // Operator=Op, ne=notequals
        });

        const allUserMessages = await Message.findAll({
          where: {
            [Op.or]: [{ from: user.username }, { to: user.username }],
          },
          order: [['createdAt', 'DESC']],
        });

        users = users.map((otherUser) => {
          const latestMessage = allUserMessages.find(
            (m) => m.from === otherUser.username || m.to === otherUser.username
          );
          otherUser.latestMessage = latestMessage;
          return otherUser;
        });

        return users;
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    login: async (_, args) => {
      const { username, password } = args;
      let errors = {};

      try {
        if (username.trim() === '')
          errors.username = 'Username must not be empty';
        if (password.trim() === '')
          errors.password = 'Password must not be empty';

        if (Object.keys(errors).length > 0)
          throw new UserInputError('bad input', { errors });

        const user = await User.findOne({
          where: { username },
        });

        if (!user) {
          errors.username = 'User not found';
          throw new UserInputError('user not found', { errors });
        }

        const correctPassword = await bcrypt.compare(password, user.password);

        if (!correctPassword) {
          errors.password = 'Password is incorrect';
          throw new UserInputError('password is incorrect', { errors });
        }

        const token = jwt.sign({ username }, process.env.JWT_SECRET_KEY, {
          expiresIn: '1h',
        });

        user.token = token;

        return {
          ...user.toJSON(),
          token,
        };
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
  },
  Mutation: {
    register: async (_, args) => {
      let { username, email, password, confirmPassword } = args;
      let errors = {};

      try {
        // Validate input data
        if (username.trim() === '')
          errors.username = 'Username must not be empty';
        if (email.trim() === '') {
          errors.email = 'Email must not be empty';
        }

        if (password.trim() === '')
          errors.password = 'Password must not be empty';
        if (confirmPassword.trim() === '')
          errors.confirmPassword = 'Confirm password must not be empty';

        if (password !== confirmPassword)
          errors.confirmPassword = 'Passwords must match';

        // // Check if username / email exists
        // const userByUsername = await User.findOne({ where: { username } });
        // const userByEmail = await User.findOne({ where: { email } });

        // if (userByUsername) errors.username = 'This username is already taken';
        // if (userByEmail) errors.email = 'This email is already taken';

        if (Object.keys(errors).length > 0) {
          throw errors;
        }

        // Hash password
        password = await bcrypt.hash(password, 6);

        // Get users gravatar
        const avatar = gravatar.url(email, {
          s: '200',
          r: 'pg',
          d: 'mp',
        });

        // Create user
        const user = await User.create({
          username: username,
          email,
          password,
          imageUrl: avatar,
        });

        // Return user
        return user;
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          err.errors.forEach(
            (e) =>
              (errors[e.path.split('.')[1]] =
                e.path.split('.')[1] === 'username'
                  ? `This username is already taken.`
                  : `Email address already in use!`)
          );
        } else if (err.name === 'SequelizeValidationError') {
          err.errors.forEach((e) => (errors[e.path] = e.message));
        }
        throw new UserInputError('Bad input', { errors });
      }
    },
  },
};
