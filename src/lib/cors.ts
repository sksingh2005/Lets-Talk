import Cors from 'cors'

// Initialize the CORS middleware
const cors = Cors({
  origin: ['http://localhost:3000', 'https://whispr1.vercel.app'], // Allowed origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

// Helper function to handle CORS in Next.js
export function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

export default cors
