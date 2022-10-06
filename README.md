# ipa-installer

Create a minimalist web interface to upload ipa files and create links in order to be able to install it on iPhones.

To build Docker image:
```
npm install
docker build -t ipa-installer .
```

To run localy:
```
node index.js
```

To configure docker-compose:
```
mkdir -p ipa-installer/data
cd ipa-installer
vi docker-compose.yml
```

create docker-compose.yml :
```
version: '2'

services:
  ipa-installer:
    container_name: ipa-installer
    restart: always
    image: vmoreau/ipa-installer:latest
    ports:
        - "8080:8080"
    volumes:
        - "./data:/usr/src/app/uploads"
    environment:
        - "PORT=8080"
        - "PROTOCOL=https"
        - "HOST=myserver.com"
        - "PREFIX=/myprefix_if_any"
```

To start container :
```
sudo docker-compose up -d
```