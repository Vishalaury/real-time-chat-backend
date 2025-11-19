import mongoose from 'mongoose';


export async function connectDB(uri) {
mongoose.set('strictQuery', true);
await mongoose.connect(uri, {
maxPoolSize: 10
});
console.log('MongoDB connected');
}