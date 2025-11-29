import { NextPageContext } from 'next'

interface ErrorProps {
  statusCode?: number
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
        {statusCode || 'Error'}
      </h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {statusCode === 404
          ? 'Page not found'
          : statusCode === 500
          ? 'Internal server error'
          : 'An error occurred'}
      </p>
      <a
        href="/"
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#1e5b9c',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '0.375rem'
        }}
      >
        Return Home
      </a>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
