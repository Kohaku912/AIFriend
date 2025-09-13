import app from './quiz.js';


export default app;

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Local dev server listening: http://localhost:${port}`);
    });
}