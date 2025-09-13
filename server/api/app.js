import app from '../quiz.js';


export { default } from '../server-for-quiz.js';

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Local dev server listening: http://localhost:${port}`);
    });
}