FROM node:10-slim

WORKDIR /data

RUN apt update \
    && apt install -y git curl apt-utils wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY ./src ./browser-ui-test-src
COPY ./package*.json ./

RUN npm install

# never use the "--no-sandbox" outside of a container!
ENTRYPOINT ["node", "./browser-ui-test-src/index.js", "--no-sandbox"]
# to be able to pass arguments to index.js
CMD []
