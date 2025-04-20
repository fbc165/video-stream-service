pipeline {
    agent any

    environment {
        PROJECT_NAME = 'video-stream-service'
    }

    stages {
        stage('Carregar Secrets') {
            steps {
                withCredentials([
                    string(credentialsId: 'DO_SPACES_ENDPOINT', variable: 'DO_SPACES_ENDPOINT'),
                    string(credentialsId: 'DO_SPACES_REGION', variable: 'DO_SPACES_REGION'),
                    string(credentialsId: 'DO_SPACES_KEY', variable: 'DO_SPACES_KEY'),
                    string(credentialsId: 'DO_SPACES_SECRET', variable: 'DO_SPACES_SECRET'),
                    string(credentialsId: 'DO_SPACES_BUCKET', variable: 'DO_SPACES_BUCKET')
                ]) {
                    sh '''
                        echo "🔐 Criando .env com variáveis..."
                        cat > .env <<EOF
                        DO_SPACES_ENDPOINT=${DO_SPACES_ENDPOINT}
                        DO_SPACES_REGION=${DO_SPACES_REGION}
                        DO_SPACES_KEY=${DO_SPACES_KEY}
                        DO_SPACES_SECRET=${DO_SPACES_SECRET}
                        DO_SPACES_BUCKET=${DO_SPACES_BUCKET}
                        EOF
                    '''
                }
            }
        }

        stage('Deploy com Docker Compose') {
            steps {
                dir("${env.WORKSPACE}") {
                    sh '''
                    echo "🧱 Parando containers existentes..."
                    docker-compose -f docker-compose.yaml -p $PROJECT_NAME down --remove-orphans

                    echo "🚀 Subindo nova versão..."
                    docker-compose -f docker-compose.yaml -p $PROJECT_NAME up --build -d
                    '''
                }
            }
        }
    }
}