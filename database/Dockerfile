FROM mysql:8.0.40

# Set the desired directories
ENV MYSQL_LOG_DIR /var/log/mysql
ENV MYSQL_DATA_DIR /var/lib/mysql

# Check if the log directory exists, and if not, create it
RUN if [ ! -d "$MYSQL_LOG_DIR" ]; then mkdir -p "$MYSQL_LOG_DIR"; fi

# Set the correct ownership and permissions for the log directory
RUN chown -R mysql:mysql "$MYSQL_LOG_DIR" && chmod 755 "$MYSQL_LOG_DIR"

# Check if the data directory exists, and if not, create it
RUN if [ ! -d "$MYSQL_DATA_DIR" ]; then mkdir -p "$MYSQL_DATA_DIR"; fi

# Set the correct ownership and permissions for the data directory
RUN chown -R mysql:mysql "$MYSQL_DATA_DIR" && chmod 700 "$MYSQL_DATA_DIR"

COPY ./scripts/ /docker-entrypoint-initdb.d/
