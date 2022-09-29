const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const Hoax = require('../src/hoax/Hoax');
const bcrypt  = require('bcrypt');
const en = require('../locales/en/translation.json');
const gr = require('../locales/gr/translation.json');
const fs = require('fs');
const path = require('path');
const config = require('config');
const pagination = require('../src/middleware/pagination');

const { uploadDir, profileDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir)

beforeEach( async () => {
    await User.destroy({ truncate : { cascade : true} });
});

const activeUser =  {
    username : 'user1',
    email : 'user1@mail.com',
    password : 'P4ssword',
    inactive : false
};

const credentials = {email: 'user1@mail.com', password:'P4ssword'};

const addUser = async (user = {...activeUser}) =>{

    const hash = await bcrypt.hash(user.password,10);
    user.password = hash;
    return await User.create(user);
}

const auth = async (options = {}) => {
    let token;
    if (options.auth) {
      const response = await request(app).post('/api/1.0/auth').send(options.auth);
      token = response.body.token;

    
    }
    return token;
  };

const deleteUser = async  (id = 5, options = {} ) => {
  const agent = request(app).delete('/api/1.0/users/' + id);
      if (options.language) {
          agent.set('Accept-Language', options.language)
      }
      if(options.token){
        agent.set('Authorization', `Bearer ${options.token}`)
      }

      return agent.send();
}


describe('User Delete', () => {

    it('returns forbidden when request sent unauthorised', async () => {
        const response = await deleteUser();
        expect(response.status).toBe(403);
    });

    it.each`
    language | message
    ${'gr'}    | ${gr.unauthorised_user_delete} 
    ${'en'}    | ${en.unauthorised_user_delete} 
    `('returns error body $message for unauthorised request when language is $language', async ({ language, message }) => {
        const nowInMillis = new Date().getTime();
        const response = await deleteUser(5, {language});
        expect(response.body.path).toBe('/api/1.0/users/5');
        expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
        expect(response.body.message).toBe(message);
      });

      it('returns forbidden when update request is sent with correct credentials but for different user', async () =>{ 
        await addUser();
        const userToBeDeleted = await addUser({ ...activeUser, username: 'user2', email: 'user2@gmail.com' , password: 'P4ssword'})
        const token = await auth({
            auth : { email: 'user1@email.com' , password : 'P4ssword'}
        });
        const response = await deleteUser( userToBeDeleted.id, { token: token});
        expect(response.status).toBe(403);
      } );

      it('returns 403 when token is not valid', async () =>{
        const response = await deleteUser(5, { token :'123 '});
        expect(response.status).toBe(403);
      });

      it('returns 200 ok when delete request is sent by an authorised user', async () =>{
        const savedUser = await addUser();
        const token = await auth({
            auth : credentials
        });
        const response =  await deleteUser(savedUser.id, { token : token });
     
        expect(response.status).toBe(200);

      });

      it('deletes user from database  when valid update request is sent by an authorised user', async () =>{
        const savedUser = await addUser();
        const token = await auth({
            auth : credentials
        });
        await deleteUser(savedUser.id, { token : token });
     
        const inDBUser = await User.findOne({ where  : { id: savedUser.id}});

        expect(inDBUser).toBeNull();
      });

      it('deletes token from database  when valid update request is sent by an authorised user', async () =>{
        const savedUser = await addUser();
        const token = await auth({
            auth : credentials
        });
        await deleteUser(savedUser.id, { token : token });
     
        const tokenInDb = await Token.findOne({ where  : { token : token}});

        expect(tokenInDb).toBeNull();
      });

      it('deletes all tokens from database  when valid update request is sent by an authorised user', async () =>{
        const savedUser = await addUser();
        const token1 = await auth({
            auth : credentials
        });

        const token2 = await auth({
            auth : credentials
        });
        await deleteUser(savedUser.id, { token : token1 });
     
        const tokenInDb = await Token.findOne({ where  : { token : token2}});

        expect(tokenInDb).toBeNull();
      });

      it('deletes hoax from database  when valid update request is sent by an authorised user', async () =>{
        const savedUser = await addUser();
        const token = await auth({
            auth : credentials
        });

        await request(app).post('/api/1.0/hoaxes')
        .set('Authorization', `Bearer ${token}`)
        .send({ content : 'Hoax content'});

        await deleteUser(savedUser.id, { token : token });
     
        const hoaxes = await Hoax.findAll();
        expect(hoaxes.length).toBe(0);
      });

      fit('removes profile image when user is deleted', async () =>{
        const user = await addUser();
        const token = await auth( { auth: credentials});
        const storedFileName = 'profile-image-for-user1';
        const testFilePath = path.join('.','__tests__','resources','test-png.png');
        const targetPath = path.join(profileFolder, storedFileName);
        fs.copyFileSync(testFilePath, targetPath);
        user.image = storedFileName;
        await user.save();
        await deleteUser(user.id, { token });
        expect(fs.existsSync(targetPath)).toBe(false);
      })
 })
