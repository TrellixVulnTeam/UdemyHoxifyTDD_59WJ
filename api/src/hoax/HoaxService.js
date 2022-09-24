const Hoax = require('./Hoax');
const User = require('../user/User');
const NotFoundException = require('../error/NotFoundException');

const save = async (body, user) =>{
    const hoax={
        content: body.content,
        timestamp: Date.now(),
        userId: user.id
    }
    await Hoax.create(hoax);
};

const getHoaxes = async ( page, size ) =>{

    const hoaxesWithCount = await Hoax.findAndCountAll({
      attributes:['id','content','timestamp'],
      include: {
        model : User,
        as: 'user',
        attributes:['id', 'username', 'email', 'image']
      },
      order: [
        ['id', 'DESC']
      ],
      limit: size,
      offset: page * size
    });
    
  return {
    content: hoaxesWithCount.rows,
    page,
    size,
    totalPages: Math.ceil( hoaxesWithCount.count / size),
  }
};

const getHoaxesOfUser = async (userId) =>{
    const user = await User.findOne({ where : { id : userId}});
    if(!user){
        throw new NotFoundException('user_not_found');
    }
    return {
        content: [],
        page: 0,
        size: 10, 
        totalPages: 0,
      }
}

module.exports = {
    save,
    getHoaxes,
    getHoaxesOfUser
};