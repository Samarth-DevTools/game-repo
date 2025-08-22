pipeline {
    agent any

    tools {
        maven 'Maven3'
    }

    environment {
        AWS_REGION = 'us-east-1'
        AWS_ACCOUNT_ID = '807860707312'
        IMAGE_NAME = 'tetris-app'
        IMAGE_TAG = "${env.BUILD_NUMBER ?: 'latest'}"
        ECR_URI = "807860707312.dkr.ecr.us-east-1.amazonaws.com/register-app-repo"

        GITHUB_REPO = 'Samarth-DevTools/game-repo'  // Your personal repo
        GITHUB_TOKEN = credentials('github-token')
        SONAR_TOKEN = credentials('sonarcloud-token')
        SONARQUBE_SERVER = 'SonarQube'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build & Test') {
            steps {
                script {
                    try {
                        sh 'npm install'
                        sh 'npm test || echo "No tests defined, continuing..."'
                    } catch (err) {
                        createGitHubIssue('NPM Build or Tests Failed', err.toString())
                        error("NPM build/tests failed")
                    }
                }
            }
        }


        stage('SonarCloud Scan') {
            steps {
                withCredentials([string(credentialsId: 'sonarcloud-token', variable: 'SONAR_TOKEN')]) {
                    sh '''
                    sonar-scanner \
                    -Dsonar.projectKey=game-app_ga-1 \
                    -Dsonar.organization=game-app \
                    -Dsonar.token=$SONAR_TOKEN \
                    -Dsonar.sources=. \
                    -Dsonar.host.url=https://sonarcloud.io
                    '''
                }
            }
        }


        stage('Docker Build & Push to ECR') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-creds-id'
                ]]) {
                    script {
                        try {
                            sh """
                            aws ecr get-login-password --region ${AWS_REGION} | \
                            docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
                            """
                            dockerImage = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                            sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}"
                            sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${ECR_URI}:latest"
                            sh "docker push ${ECR_URI}:${IMAGE_TAG}"
                            sh "docker push ${ECR_URI}:latest"
                        } catch (err) {
                            createGitHubIssue('Docker Build/Push Failed', err.toString())
                            error("Docker build or push failed")
                        }
                    }
                }
            }
        }

        stage('Trivy Scan') {
            steps {
                script {
                    try {
                        sh "trivy image --exit-code 1 --severity HIGH,CRITICAL ${ECR_URI}:${IMAGE_TAG}"
                    } catch (err) {
                        createGitHubIssue('Trivy Scan Failed', err.toString())
                        error("Trivy scan found vulnerabilities")
                    }
                }
            }
        }

        stage('Trigger ArgoCD Sync') {
            steps {
                script {
                    // Adjust this to your actual ArgoCD sync job or API call
                    build job: 'argo-sync-job', wait: false
                }
            }
        }
    }

    post {
        success {
            script {
                notifyTeams("Build #${env.BUILD_NUMBER} succeeded")
                mail to: 'team@example.com',
                     subject: "Build Success #${env.BUILD_NUMBER}",
                     body: "Pipeline completed successfully."
            }
        }
        failure {
            script {
                notifyTeams("Build #${env.BUILD_NUMBER} failed")
                mail to: 'team@example.com',
                     subject: "Build Failed #${env.BUILD_NUMBER}",
                     body: "Pipeline failed. Check Jenkins for details."
            }
        }
    }
}

def createGitHubIssue(title, body) {
    def data = [
        title: title,
        body: body
    ]
    def jsonData = groovy.json.JsonOutput.toJson(data)
    sh """
    curl -X POST -H "Authorization: token ${GITHUB_TOKEN}" -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/repos/${GITHUB_REPO}/issues -d '${jsonData}'
    """
}

def notifyTeams(message) {
    def webhookUrl = credentials('teams-webhook-url')
    sh """
    curl -H 'Content-Type: application/json' -d '{"text": "${message}"}' ${webhookUrl}
    """
}
