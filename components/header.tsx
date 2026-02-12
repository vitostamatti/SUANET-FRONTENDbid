const Header = () => {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    return (
      <header>
              <a href={url}></a>              
      </header>
            
      
    )
  }

  
  export default Header