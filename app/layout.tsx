import './global.css'

export const metadata = {
  title: 'AnimeGPT',
  description: 'Chat with an anime expert that helps you discover shows, characters, stories, and recommendations instantly.',
}

const RootLayout = ({ children }) => { 
    return (
        <html lang='en'>
        <body> {children} </body>
        </html>
    )
}

export default RootLayout;