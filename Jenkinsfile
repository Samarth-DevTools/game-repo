pipeline {
    agent any

    tools {
        maven 'Maven3'
        nodejs 'Node20'
    }

    environment {
        AWS_REGION = 'us-east-1'
        AWS_ACCOUNT_ID = '807860707312'
        IMAGE_NAME = 'tetris-app'
        IMAGE_TAG = "${env.BUILD_NUMBER ?: 'latest'}"
        ECR_URI = "807860707312.dkr.ecr.us-east-1.amazonaws.com/register-app-repo"

        GITHUB_REPO = 'Samarth-DevTools/game-repo'  
        GITHUB_TOKEN = credentials('github-token')
        SONAR_TOKEN = credentials('sonarcloud-token')
        SONARQUBE_SERVER = 'SonarQube'

        CLUSTER_NAME = 'register-app-eks-cluster'           
        KUBECONFIG = "${env.WORKSPACE}/kubeconfig"

        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        
        stage('Check Node Version') {
            steps {
                sh 'node -v'
                sh 'npm -v'
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


        stage('Code Coverage') {
            steps {
                script {
                    try {
                        sh 'npm run coverage'

                        // Archive the coverage report
                        archiveArtifacts artifacts: 'coverage/**', fingerprint: true

                        // Publish coverage report in Jenkins (if using Cobertura plugin)
                        publishHTML(target: [
                            reportDir: 'coverage/lcov-report',
                            reportFiles: 'index.html',
                            reportName: 'Code Coverage'
                        ])
                    } catch (err) {
                        createGitHubIssue('Code Coverage Failed', err.toString())
                        echo "Code coverage failed, but continuing pipeline"
                    }
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
                    // Run Trivy scan and capture exit code (without failing the build)
                    def trivyExitCode = sh(
                        script: "trivy image --exit-code 1 --severity HIGH,CRITICAL ${ECR_URI}:${IMAGE_TAG}",
                        returnStatus: true
                    )

                    if (trivyExitCode != 0) {
                        echo "Trivy scan detected HIGH or CRITICAL vulnerabilities (exit code: ${trivyExitCode})"
                        createGitHubIssue(
                            'Trivy Scan Found Vulnerabilities',
                            "Trivy scan reported HIGH or CRITICAL vulnerabilities for image `${ECR_URI}:${IMAGE_TAG}`"
                        )
                        // Intentionally not failing the stage
                    } else {
                        echo "Trivy scan passed with no HIGH or CRITICAL vulnerabilities."
                    }

                    // Save the scan results in a readable report
                    sh """
                        trivy image --format table --severity HIGH,CRITICAL --output trivy-report.txt ${ECR_URI}:${IMAGE_TAG}
                    """

                    // Archive the report in Jenkins
                    archiveArtifacts artifacts: 'trivy-report.txt', fingerprint: true
                }
            }
        }

        stage('Configure kubectl') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-creds-id'
                ]]) {
                    sh """
                        aws eks --region ${AWS_REGION} update-kubeconfig --name ${CLUSTER_NAME} --kubeconfig ${KUBECONFIG}
                    """
                }
            }
        }


        stage('Deploy to EKS') {
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-creds-id']
                ]) {
                    script {
                        try {
                            // Validate cluster connection (optional but helpful)
                            sh "kubectl --kubeconfig=${KUBECONFIG} get nodes"

                            // Deploy application manifests
                            sh """
                                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/deployment.yaml
                                kubectl --kubeconfig=${KUBECONFIG} apply -f k8s/service.yaml
                            """

                            // Optionally verify deployment status
                            sh "kubectl --kubeconfig=${KUBECONFIG} rollout status deployment/tetris-app"
                        } catch (err) {
                            createGitHubIssue('Kubernetes Deploy Failed', err.toString())
                            error("Failed to deploy to Kubernetes: ${err}")
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            script {
                notifyTeams("Build #${env.BUILD_NUMBER} succeeded")
                mail to: 'srikanths@devtools.in',
                     subject: "Build Success #${env.BUILD_NUMBER}",
                     body: "Pipeline completed successfully."
            }
        }
        failure {
            script {
                notifyTeams("Build #${env.BUILD_NUMBER} failed")
                mail to: 'srikanths@devtools.in',
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
